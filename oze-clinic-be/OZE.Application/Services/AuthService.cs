using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly IUserRefreshTokenRepository _refreshTokenRepository;
        private readonly IJwtTokenGenerator _jwtTokenGenerator;
        private readonly IUserService _userService;
        private readonly ISmsSender _smsSender;
        private readonly IPendingRegistrationStore _pendingRegistrationStore;
        private readonly IPasswordResetStore _passwordResetStore;
        private readonly IRegistrationRepository _registrationRepository;
        private readonly JwtSettings _jwtSettings;
        private readonly RegisterOtpSettings _otpSettings;
        private readonly ILogger<AuthService> _logger;
        private readonly IOtpSendLimiter? _otpSendLimiter;
        private readonly AuthSmsSenderOptions _smsOptions;
        private readonly IGoogleIdTokenValidator _googleIdTokenValidator;
        private readonly GoogleAuthSettings _googleAuthSettings;

        private const string GoogleLoginProvider = "Google";

        public AuthService(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IUserRefreshTokenRepository refreshTokenRepository,
            IJwtTokenGenerator jwtTokenGenerator,
            IUserService userService,
            ISmsSender smsSender,
            IPendingRegistrationStore pendingRegistrationStore,
            IPasswordResetStore passwordResetStore,
            IRegistrationRepository registrationRepository,
            IOptions<JwtSettings> jwtOptions,
            IOptions<RegisterOtpSettings> otpOptions,
            ILogger<AuthService> logger,
            IGoogleIdTokenValidator googleIdTokenValidator,
            IOptions<GoogleAuthSettings> googleAuthOptions,
            IOtpSendLimiter? otpSendLimiter = null,
            IOptions<AuthSmsSenderOptions>? smsOptions = null)
        {
            _otpSendLimiter = otpSendLimiter;
            _smsOptions = smsOptions?.Value ?? new AuthSmsSenderOptions();
            _userManager = userManager;
            _signInManager = signInManager;
            _refreshTokenRepository = refreshTokenRepository;
            _jwtTokenGenerator = jwtTokenGenerator;
            _userService = userService;
            _smsSender = smsSender;
            _pendingRegistrationStore = pendingRegistrationStore;
            _passwordResetStore = passwordResetStore;
            _registrationRepository = registrationRepository;
            _jwtSettings = jwtOptions.Value;
            _otpSettings = otpOptions.Value;
            _logger = logger;
            _googleIdTokenValidator = googleIdTokenValidator;
            _googleAuthSettings = googleAuthOptions.Value;
        }

        public async Task<ApiResponse<RegisterPendingResponse>> RegisterAsync(RegisterRequest request, string baseUrl)
        {
            if (!PhoneNumberHelper.TryNormalize(request.PhoneNumber, out var phoneNumber))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.InvalidPhone);
            }

            // BR-055: the date of birth cannot be in the future. The clinic works in Vietnam time (UTC+7).
            var dateOfBirth = request.DateOfBirth!.Value;
            if (dateOfBirth > ClinicClock.TodayDate)
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.DateOfBirthInvalid);
            }

            var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
            if (email != null && (email.Length > 256 || !new EmailAddressAttribute().IsValid(email)))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.EmailInvalid);
            }

            // OTP is SMS-only; email is optional contact for later notifications
            if (!string.Equals(request.VerificationMethod, VerificationMethodConstants.Sms, StringComparison.OrdinalIgnoreCase))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.VerificationMethodInvalid);
            }

            // An account that never finished OTP verification is reused, so the guest can sign up again.
            var user = await _registrationRepository.FindUserByPhoneAsync(PhoneNumberHelper.GetLookupVariants(phoneNumber));
            if (user != null && !await IsPendingRegistrationAsync(user))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(
                    string.Format(ErrorConstants.AuthMessage.PhoneExist, request.PhoneNumber.Trim()));
            }

            if (email != null)
            {
                var emailOwner = await _userManager.FindByEmailAsync(email);
                if (emailOwner != null && emailOwner.Id != user?.Id)
                {
                    // Only an unfinished sign-up gives the email up; a real account keeps its contacts (a contact it never
                    // proved cannot be used to sign in or to reset the password, see FindUserByIdentifierAsync and ForgotPasswordAsync)
                    if (!await IsPendingRegistrationAsync(emailOwner))
                    {
                        return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.EmailExist);
                    }
                    await ReleaseEmailAsync(emailOwner);
                }
            }

            // A code goes to this phone: only a few per hour, so codes cannot be guessed sign-up after sign-up
            _otpSendLimiter?.EnsureCanSend(SecurityConstants.OtpPurposeRegister, phoneNumber);

            var saved = await _registrationRepository.ExecuteInTransactionAsync(
                () => SaveUnverifiedUserAsync(user, phoneNumber, email, request.Password),
                result => result.Result.Succeeded);
            if (!saved.Result.Succeeded)
            {
                var errors = saved.Result.Errors.Select(e => e.Description).ToList();
                return ApiResponse<RegisterPendingResponse>.FailureResult("User registration failed", errors);
            }

            var now = DateTime.UtcNow;
            var pending = new PendingRegistration
            {
                SessionId = Guid.NewGuid().ToString("N"),
                UserId = saved.User.Id,
                SecurityStamp = saved.User.SecurityStamp ?? string.Empty,
                VerificationMethod = VerificationMethodConstants.Sms,
                FullName = request.FullName.Trim(),
                DateOfBirth = dateOfBirth,
                Gender = request.Gender,
                Email = email,
                PhoneNumber = phoneNumber,
                ExpiresAt = now.AddMinutes(OtpExpiresInMinutes),
                LastSentAt = now,
                FailedAttempts = 0
            };

            var otp = OtpHelper.Generate();
            pending.OtpHash = OtpHelper.Hash(pending.SessionId, otp);
            if (!await SendOtpAsync(pending, otp))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpSendFailed);
            }

            _pendingRegistrationStore.Save(pending, pending.ExpiresAt - now);

            return ApiResponse<RegisterPendingResponse>.SuccessResult(ToPendingResponse(pending), OtpSentMessage(pending));
        }

        public async Task<ApiResponse<RegisterPendingResponse>> ResendOtpAsync(ResendOtpRequest request)
        {
            var pending = _pendingRegistrationStore.Get(request.SessionId);
            if (pending == null || pending.ExpiresAt <= DateTime.UtcNow)
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpExpired);
            }

            if (DateTime.UtcNow < pending.LastSentAt.AddSeconds(ResendCooldownSeconds))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpResendTooSoon);
            }

            if (await GetPendingUserAsync(pending) == null)
            {
                _pendingRegistrationStore.Remove(pending.SessionId);
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpExpired);
            }

            _otpSendLimiter?.EnsureCanSend(SecurityConstants.OtpPurposeRegister, pending.PhoneNumber);

            // The previous OTP stays valid if the new one cannot be sent.
            var otp = OtpHelper.Generate();
            if (!await SendOtpAsync(pending, otp))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpSendFailed);
            }

            var now = DateTime.UtcNow;
            pending.OtpHash = OtpHelper.Hash(pending.SessionId, otp);
            pending.LastSentAt = now;
            pending.ExpiresAt = now.AddMinutes(OtpExpiresInMinutes);
            pending.FailedAttempts = 0;
            _pendingRegistrationStore.Save(pending, pending.ExpiresAt - now);

            return ApiResponse<RegisterPendingResponse>.SuccessResult(ToPendingResponse(pending), OtpSentMessage(pending));
        }

        public async Task<ApiResponse> VerifyOtpAsync(VerifyOtpRequest request, string baseUrl)
        {
            var pending = _pendingRegistrationStore.Get(request.SessionId);
            if (pending == null || pending.ExpiresAt <= DateTime.UtcNow)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.OtpExpired);
            }

            var maxAttempts = _otpSettings.MaxAttempts > 0 ? _otpSettings.MaxAttempts : 5;
            if (pending.FailedAttempts >= maxAttempts)
            {
                _pendingRegistrationStore.Remove(pending.SessionId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.InvalidOtp);
            }

            if (!OtpHelper.Matches(pending.OtpHash, pending.SessionId, request.Otp))
            {
                pending.FailedAttempts++;
                if (pending.FailedAttempts >= maxAttempts)
                {
                    _pendingRegistrationStore.Remove(pending.SessionId);
                }
                else
                {
                    _pendingRegistrationStore.Save(pending, pending.ExpiresAt - DateTime.UtcNow);
                }

                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.InvalidOtp);
            }

            var user = await GetPendingUserAsync(pending);
            if (user == null)
            {
                _pendingRegistrationStore.Remove(pending.SessionId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.OtpExpired);
            }

            var activated = await _registrationRepository.ExecuteInTransactionAsync(
                () => ActivateAccountAsync(user, pending),
                result => result.Success);
            _pendingRegistrationStore.Remove(pending.SessionId);
            if (!activated.Success)
            {
                return activated;
            }

            return activated;
        }

        private async Task<(IdentityResult Result, ApplicationUser User)> SaveUnverifiedUserAsync(
            ApplicationUser? user, string phoneNumber, string? email, string password)
        {
            var isNew = user == null;
            user ??= new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                CreatedAt = ClinicClock.UtcNow
            };

            user.UserName = phoneNumber;
            user.PhoneNumber = phoneNumber;
            user.PhoneNumberConfirmed = false;
            user.Email = email;
            user.EmailConfirmed = false;
            // The account cannot sign in until the OTP is verified.
            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;
            // Hashed here instead of CreateAsync(user, password): the Identity password policy differs from the 8-32 rule of Register.
            user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, password);
            // A new stamp makes the OTP sessions of an earlier sign-up attempt invalid.
            user.SecurityStamp = Guid.NewGuid().ToString();

            var result = isNew ? await _userManager.CreateAsync(user) : await _userManager.UpdateAsync(user);
            if (result.Succeeded && !await _userManager.IsInRoleAsync(user, RoleConstants.PatientRole))
            {
                result = await _userManager.AddToRoleAsync(user, RoleConstants.PatientRole);
            }

            return (result, user);
        }

        private async Task<ApiResponse> ActivateAccountAsync(ApplicationUser user, PendingRegistration pending)
        {
            var walkInPatients = await _registrationRepository.FindUnlinkedPatientsByPhoneAsync(
                PhoneNumberHelper.GetLookupVariants(pending.PhoneNumber));

            // BR-056, BR-058: the record with the same verified phone number is linked instead of creating a new one.
            if (walkInPatients.Count > 1)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.MultiplePatientRecords);
            }

            if (walkInPatients.Count == 1)
            {
                LinkPatient(walkInPatients[0], user, pending);
            }
            else
            {
                user.Patient = CreatePatient(pending);
            }

            user.PhoneNumberConfirmed = true;

            user.LockoutEnd = null;
            user.AccessFailedCount = 0;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToList();
                return ApiResponse.FailureResult("User registration failed", errors);
            }

            return ApiResponse.SuccessResult(ErrorConstants.AuthMessage.AccountCreated);
        }

        private static Patient CreatePatient(PendingRegistration pending)   
        {
            return new Patient
            {
                PatientCode = PatientCodeHelper.Generate(),
                FullName = pending.FullName,
                DateOfBirth = pending.DateOfBirth,
                Gender = pending.Gender,
                PhoneNumber = pending.PhoneNumber,
                Email = pending.Email,
                CreatedAt = ClinicClock.UtcNow
            };
        }

        // Only empty fields are filled; data entered by the reception desk is kept.
        private static void LinkPatient(Patient patient, ApplicationUser user, PendingRegistration pending)
        {
            patient.UserId = user.Id;
            patient.DateOfBirth ??= pending.DateOfBirth;
            if (string.IsNullOrWhiteSpace(patient.Gender))
            {
                patient.Gender = pending.Gender;
            }
            if (string.IsNullOrWhiteSpace(patient.Email))
            {
                patient.Email = pending.Email;
            }
            patient.UpdatedAt = ClinicClock.UtcNow;
        }

        // Returns the account of the OTP session while it is still waiting for verification.
        private async Task<ApplicationUser?> GetPendingUserAsync(PendingRegistration pending)
        {
            var user = await _userManager.FindByIdAsync(pending.UserId);
            if (user == null || user.SecurityStamp != pending.SecurityStamp || !await IsPendingRegistrationAsync(user))
            {
                return null;
            }

            return user;
        }

        // A contact of a patient that was never proved (staff contacts are set by the manager)
        private async Task<bool> IsUnprovenPatientContactAsync(ApplicationUser owner, bool contactConfirmed)
        {
            return !contactConfirmed && await _userManager.IsInRoleAsync(owner, RoleConstants.PatientRole);
        }

        // Only for an unfinished sign-up, which never proved anything
        private async Task ReleaseEmailAsync(ApplicationUser owner)
        {
            var email = owner.Email;
            owner.Email = null;
            owner.NormalizedEmail = null;
            owner.EmailConfirmed = false;
            if (string.Equals(owner.UserName, email, StringComparison.OrdinalIgnoreCase))
            {
                owner.UserName = owner.PhoneNumber ?? owner.Id;
            }
            owner.SecurityStamp = Guid.NewGuid().ToString();
            var result = await _userManager.UpdateAsync(owner);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException("Could not release the email of an unfinished sign-up: " + string.Join("; ", result.Errors.Select(e => e.Description)));
            }
            _logger.LogInformation("Email released from unfinished sign-up {UserId}", owner.Id);
        }

        private async Task<bool> IsPendingRegistrationAsync(ApplicationUser user)
        {
            return !user.PhoneNumberConfirmed
                && !user.EmailConfirmed
                && user.LockoutEnd == DateTimeOffset.MaxValue
                && await _userManager.IsInRoleAsync(user, RoleConstants.PatientRole);
        }

        private async Task<bool> SendOtpAsync(PendingRegistration pending, string otp)
        {
            try
            {
                await _smsSender.SendSmsAsync(
                    pending.PhoneNumber,
                    AuthSmsSenderOptions.RenderOtp(_smsOptions.OtpTemplate, AuthSmsSenderOptions.DefaultOtpTemplate, otp, OtpExpiresInMinutes));
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send registration OTP by SMS (UserId: {UserId})", pending.UserId);
                return false;
            }
        }

        private int OtpExpiresInMinutes => _otpSettings.ExpiresInMinutes > 0 ? _otpSettings.ExpiresInMinutes : 5;

        private int ResendCooldownSeconds => _otpSettings.ResendCooldownSeconds > 0 ? _otpSettings.ResendCooldownSeconds : 60;

        private static string OtpSentMessage(PendingRegistration pending) => ErrorConstants.AuthMessage.OtpSentSms;

        private RegisterPendingResponse ToPendingResponse(PendingRegistration pending)
        {
            return new RegisterPendingResponse
            {
                SessionId = pending.SessionId,
                VerificationMethod = VerificationMethodConstants.Sms,
                MaskedDestination = PhoneNumberHelper.Mask(pending.PhoneNumber),
                ExpiresAt = pending.ExpiresAt,
                ResendAvailableAt = pending.LastSentAt.AddSeconds(ResendCooldownSeconds)
            };
        }

        public async Task<ApiResponse<AuthResult>> LoginAsync(LoginRequest request)
        {
            var user = await FindUserByIdentifierAsync(request.Identifier.Trim());
            if (user == null || await IsPendingRegistrationAsync(user))
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.InvalidLogin, ErrorConstants.AuthCode.InvalidCredentials);

            var signIn = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
            if (signIn.IsLockedOut)
            {
                // Staff deactivation uses LockoutEnd = MaxValue; temporary lockout uses a finite instant (BR-101 / MSG80).
                if (IsPermanentlyDisabled(user))
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.AccountDisabled, ErrorConstants.AuthCode.AccountDisabled);

                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.AccountLocked,
                    ErrorConstants.AuthCode.LockedOut,
                    user.LockoutEnd);
            }
            if (!signIn.Succeeded)
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.InvalidLogin, ErrorConstants.AuthCode.InvalidCredentials);

            return await IssueAuthResultAsync(user);
        }

        public async Task<ApiResponse<AuthResult>> GoogleLoginAsync(GoogleLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(_googleAuthSettings.ClientId))
            {
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.GoogleNotConfigured, ErrorConstants.AuthCode.GoogleNotConfigured);
            }

            var payload = await ResolveGooglePayloadAsync(request);
            if (payload == null)
            {
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.GoogleTokenInvalid, ErrorConstants.AuthCode.GoogleTokenInvalid);
            }

            if (string.IsNullOrWhiteSpace(payload.Email))
            {
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.GoogleTokenInvalid, ErrorConstants.AuthCode.GoogleTokenInvalid);
            }

            if (!payload.EmailVerified)
            {
                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.GoogleEmailNotVerified, ErrorConstants.AuthCode.GoogleEmailNotVerified);
            }

            var email = payload.Email.Trim();
            var user = await _userManager.FindByLoginAsync(GoogleLoginProvider, payload.Subject);
            if (user == null)
            {
                user = await _userManager.FindByEmailAsync(email);
            }

            if (user != null)
            {
                if (await IsPendingRegistrationAsync(user))
                {
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.InvalidLogin, ErrorConstants.AuthCode.InvalidCredentials);
                }

                if (IsPermanentlyDisabled(user))
                {
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.AccountDisabled, ErrorConstants.AuthCode.AccountDisabled);
                }

                if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
                {
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.AccountLocked,
                        ErrorConstants.AuthCode.LockedOut,
                        user.LockoutEnd);
                }

                if (!await _userManager.IsInRoleAsync(user, RoleConstants.PatientRole))
                {
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.GoogleNotPatient, ErrorConstants.AuthCode.GoogleNotPatient);
                }

                var existingLogins = await _userManager.GetLoginsAsync(user);
                if (!existingLogins.Any(l => l.LoginProvider == GoogleLoginProvider && l.ProviderKey == payload.Subject))
                {
                    var addLogin = await _userManager.AddLoginAsync(
                        user, new UserLoginInfo(GoogleLoginProvider, payload.Subject, GoogleLoginProvider));
                    if (!addLogin.Succeeded)
                    {
                        var errors = addLogin.Errors.Select(e => e.Description).ToList();
                        return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.GoogleTokenInvalid, errors);
                    }
                }

                if (!user.EmailConfirmed)
                {
                    user.EmailConfirmed = true;
                    var confirmResult = await _userManager.UpdateAsync(user);
                    if (!confirmResult.Succeeded)
                    {
                        var errors = confirmResult.Errors.Select(e => e.Description).ToList();
                        return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.GoogleTokenInvalid, errors);
                    }
                }
            }
            else
            {
                user = await CreatePatientFromGoogleAsync(payload, email);
                if (user == null)
                {
                    return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.GoogleTokenInvalid);
                }
            }

            return await IssueAuthResultAsync(user);
        }

        private async Task<GoogleIdTokenPayload?> ResolveGooglePayloadAsync(GoogleLoginRequest request)
        {
            if (!string.IsNullOrWhiteSpace(request.IdToken))
            {
                return await _googleIdTokenValidator.ValidateAsync(request.IdToken);
            }

            if (!string.IsNullOrWhiteSpace(request.AccessToken))
            {
                return await _googleIdTokenValidator.ResolveAccessTokenAsync(request.AccessToken);
            }

            return null;
        }

        private async Task<ApplicationUser?> CreatePatientFromGoogleAsync(GoogleIdTokenPayload payload, string email)
        {
            var fullName = ResolveGoogleDisplayName(payload.Name, email);
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                PhoneNumber = null,
                PhoneNumberConfirmed = false,
                LockoutEnabled = true,
                LockoutEnd = null,
                CreatedAt = ClinicClock.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString()
            };
            user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, Guid.NewGuid().ToString("N"));

            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                _logger.LogWarning(
                    "Google patient create failed: {Errors}",
                    string.Join("; ", createResult.Errors.Select(e => e.Description)));
                return null;
            }

            var roleResult = await _userManager.AddToRoleAsync(user, RoleConstants.PatientRole);
            if (!roleResult.Succeeded)
            {
                _logger.LogWarning(
                    "Google patient role failed: {Errors}",
                    string.Join("; ", roleResult.Errors.Select(e => e.Description)));
                return null;
            }

            var loginResult = await _userManager.AddLoginAsync(
                user, new UserLoginInfo(GoogleLoginProvider, payload.Subject, GoogleLoginProvider));
            if (!loginResult.Succeeded)
            {
                _logger.LogWarning(
                    "Google patient external login failed: {Errors}",
                    string.Join("; ", loginResult.Errors.Select(e => e.Description)));
                return null;
            }

            user.Patient = new Patient
            {
                PatientCode = PatientCodeHelper.Generate(),
                FullName = fullName,
                Email = email,
                PhoneNumber = null,
                CreatedAt = ClinicClock.UtcNow
            };

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                _logger.LogWarning(
                    "Google patient profile save failed: {Errors}",
                    string.Join("; ", updateResult.Errors.Select(e => e.Description)));
                return null;
            }

            return user;
        }

        private static string ResolveGoogleDisplayName(string? name, string email)
        {
            if (!string.IsNullOrWhiteSpace(name))
            {
                return name.Trim();
            }

            var at = email.IndexOf('@');
            return at > 0 ? email[..at] : email;
        }

        private async Task<ApiResponse<AuthResult>> IssueAuthResultAsync(ApplicationUser user)
        {
            var now = DateTime.UtcNow;
            var accessTokenMinutes = _jwtSettings.ExpiresInMinutes > 0 ? _jwtSettings.ExpiresInMinutes : 60;
            var token = await _jwtTokenGenerator.GenerateTokenAsync(user);
            var refreshToken = _jwtTokenGenerator.GenerateRefreshToken();

            await _refreshTokenRepository.AddAsync(new UserRefreshToken
            {
                UserId = user.Id,
                RefreshToken = refreshToken,
                ExpiryDate = now.AddDays(7)
            });
            await _refreshTokenRepository.SaveChangesAsync();

            return ApiResponse<AuthResult>.SuccessResult(
                await ToAuthResultAsync(user, token, refreshToken, now.AddMinutes(accessTokenMinutes)),
                "Login successful");
        }

        private async Task<ApplicationUser?> FindUserByIdentifierAsync(string identifier)
        {
            if (identifier.Contains('@'))
            {
                // A patient signs in with an email only once it is confirmed; until then the phone number works
                var byEmail = await _userManager.FindByEmailAsync(identifier);
                if (byEmail != null && !byEmail.EmailConfirmed && await _userManager.IsInRoleAsync(byEmail, RoleConstants.PatientRole))
                {
                    return null;
                }
                return byEmail;
            }

            if (!PhoneNumberHelper.TryNormalize(identifier, out var phone))
                return null;

            return await _registrationRepository.FindUserByPhoneAsync(PhoneNumberHelper.GetLookupVariants(phone));
        }
        public async Task<ApiResponse<AuthResult>> RefreshTokenAsync(RefreshTokenRequest request)
        {
            var activeToken = await _refreshTokenRepository.GetActiveTokenAsync(request.RefreshToken);
            if (activeToken == null)
            {
                // BR-102: deactivation revokes every refresh token, so tell the client the account is disabled (MSG80)
                // instead of a plain invalid token.
                var knownToken = await _refreshTokenRepository.GetByTokenAsync(request.RefreshToken);
                if (knownToken != null)
                {
                    var owner = await _userManager.FindByIdAsync(knownToken.UserId);
                    if (owner != null && IsPermanentlyDisabled(owner))
                        return ApiResponse<AuthResult>.FailureWithCode(
                            ErrorConstants.AuthMessage.AccountDisabled, ErrorConstants.AuthCode.AccountDisabled);
                }

                return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.InvalidRefreshToken);
            }

            var user = await _userManager.FindByIdAsync(activeToken.UserId);
            if (user == null)
            {
                return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.UserNotFound);
            }

            // BR-101 / BR-102: do not rotate tokens while the account is locked or disabled.
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                if (IsPermanentlyDisabled(user))
                    return ApiResponse<AuthResult>.FailureWithCode(
                        ErrorConstants.AuthMessage.AccountDisabled, ErrorConstants.AuthCode.AccountDisabled);

                return ApiResponse<AuthResult>.FailureWithCode(
                    ErrorConstants.AuthMessage.AccountLocked,
                    ErrorConstants.AuthCode.LockedOut,
                    user.LockoutEnd);
            }

            // Revoke the old refresh token in one statement that only succeeds while it is still active,
            // so two calls with the same token cannot both get a new pair
            if (!await _refreshTokenRepository.TryRevokeAsync(activeToken.Id, DateTimeOffset.UtcNow))
            {
                return ApiResponse<AuthResult>.FailureResult(ErrorConstants.AuthMessage.InvalidRefreshToken);
            }

            // Generate new token pair
            var newAccessToken = await _jwtTokenGenerator.GenerateTokenAsync(user);
            var newRefreshToken = _jwtTokenGenerator.GenerateRefreshToken();

            var newTokenEntry = new UserRefreshToken
            {
                UserId = user.Id,
                RefreshToken = newRefreshToken,
                ExpiryDate = DateTimeOffset.UtcNow.AddDays(7)
            };

            await _refreshTokenRepository.AddAsync(newTokenEntry);
            await _refreshTokenRepository.SaveChangesAsync();

            var expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiresInMinutes > 0 ? _jwtSettings.ExpiresInMinutes : 60);
            return ApiResponse<AuthResult>.SuccessResult(
                await ToAuthResultAsync(user, newAccessToken, newRefreshToken, expiresAt),
                "Token refreshed successfully");
        }

        private async Task<AuthResult> ToAuthResultAsync(
            ApplicationUser user, string token, string refreshToken, DateTime expiresAt)
        {
            var roles = await _userManager.GetRolesAsync(user);
            return new AuthResult
            {
                Token = token,
                RefreshToken = refreshToken,
                ExpiresAt = expiresAt,
                FullName = _userService.GetFullName(user.Id),
                Role = roles.FirstOrDefault()
            };
        }

        public async Task<ApiResponse> LogoutAsync(string? userId, string? refreshToken = null)
        {
            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                // BR-109: revoke this refresh token even when the access token has already expired.
                var token = await _refreshTokenRepository.GetActiveTokenAsync(refreshToken);
                if (token != null)
                {
                    token.RevokedAt = DateTimeOffset.UtcNow;
                    await _refreshTokenRepository.UpdateAsync(token);
                }
            }
            else if (!string.IsNullOrEmpty(userId))
            {
                // Revoke every device only when the caller has a valid access token (userId from JWT).
                await _refreshTokenRepository.RevokeUserTokensAsync(userId);
            }
            else
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.LogoutRequiresToken);
            }

            await _refreshTokenRepository.SaveChangesAsync();

            return ApiResponse.SuccessResult("Logged out successfully");
        }

        // Staff deactivation sets LockoutEnd to MaxValue; temporary lockout uses a finite instant.
        private static bool IsPermanentlyDisabled(ApplicationUser user) =>
            user.LockoutEnd.HasValue && user.LockoutEnd.Value == DateTimeOffset.MaxValue;

        public async Task<ApiResponse> ConfirmEmailAsync(string userId, string code)
        {
            // The same answer for an unknown user and a bad code, so the link does not tell which accounts exist
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.InvalidConfirmationLink);
            }

            try
            {
                var decodedCode = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
                var result = await _userManager.ConfirmEmailAsync(user, decodedCode);

                if (!result.Succeeded)
                {
                    var errors = result.Errors.Select(e => e.Description).ToList();
                    return ApiResponse.FailureResult("Email confirmation failed", errors);
                }

                return ApiResponse.SuccessResult("Email confirmed successfully");
            }
            catch (Exception ex)
            {
                // The details stay in the log, not in the answer
                _logger.LogWarning(ex, "Email confirmation failed for user {UserId}", userId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.InvalidConfirmationLink);
            }
        }

        public async Task<ApiResponse<RegisterPendingResponse>> ForgotPasswordAsync(ForgotPasswordRequest request)
        {
            var identifier = request.Identifier.Trim();
            if (identifier.Contains('@'))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.PasswordResetPhoneOnly);
            }

            if (!PhoneNumberHelper.TryNormalize(identifier, out var destination))
            {
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.InvalidPhone);
            }

            var user = await _registrationRepository.FindUserByPhoneAsync(PhoneNumberHelper.GetLookupVariants(destination));

            // Counted for every identifier, known or not, so the limit does not tell which accounts exist either
            _otpSendLimiter?.EnsureCanSend(SecurityConstants.OtpPurposePasswordReset, destination);

            var now = DateTime.UtcNow;
            // No account, an unfinished sign-up, or a patient contact never proved (whoever holds it is maybe not the patient):
            // the same answer as a real one, and a session that no code opens, so neither the answer nor the next step
            // tells which accounts exist. Staff contacts are set by the manager and count as proved
            if (user == null || await IsPendingRegistrationAsync(user)
                || await IsUnprovenPatientContactAsync(user, user.PhoneNumberConfirmed))
            {
                var decoy = new PasswordResetSession
                {
                    SessionId = Guid.NewGuid().ToString("N"),
                    UserId = string.Empty,
                    ExpiresAt = now.AddMinutes(OtpExpiresInMinutes)
                };
                decoy.OtpHash = OtpHelper.Hash(decoy.SessionId, Guid.NewGuid().ToString("N"));
                _passwordResetStore.Save(decoy, decoy.ExpiresAt - now);
                return ApiResponse<RegisterPendingResponse>.SuccessResult(new RegisterPendingResponse
                {
                    SessionId = decoy.SessionId,
                    VerificationMethod = VerificationMethodConstants.Sms,
                    MaskedDestination = PhoneNumberHelper.Mask(destination),
                    ExpiresAt = decoy.ExpiresAt,
                    ResendAvailableAt = now.AddSeconds(ResendCooldownSeconds)
                });
            }

            var session = new PasswordResetSession
            {
                SessionId = Guid.NewGuid().ToString("N"),
                UserId = user.Id,
                ExpiresAt = now.AddMinutes(OtpExpiresInMinutes)
            };

            var otp = OtpHelper.Generate();
            session.OtpHash = OtpHelper.Hash(session.SessionId, otp);

            try
            {
                await _smsSender.SendSmsAsync(destination,
                    AuthSmsSenderOptions.RenderOtp(_smsOptions.ResetPasswordOtpTemplate, AuthSmsSenderOptions.DefaultResetPasswordOtpTemplate, otp, OtpExpiresInMinutes));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send password reset OTP (UserId: {UserId})", user.Id);
                return ApiResponse<RegisterPendingResponse>.FailureResult(ErrorConstants.AuthMessage.OtpSendFailed);
            }

            _passwordResetStore.Save(session, session.ExpiresAt - now);

            return ApiResponse<RegisterPendingResponse>.SuccessResult(new RegisterPendingResponse
            {
                SessionId = session.SessionId,
                VerificationMethod = VerificationMethodConstants.Sms,
                MaskedDestination = PhoneNumberHelper.Mask(destination),
                ExpiresAt = session.ExpiresAt,
                ResendAvailableAt = now.AddSeconds(ResendCooldownSeconds)
            });
        }

        // Step 2 of password recovery: a correct OTP unlocks ResetPasswordAsync for this session
        public async Task<ApiResponse> VerifyResetOtpAsync(VerifyResetOtpRequest request)
        {
            var session = _passwordResetStore.Get(request.SessionId);
            if (session == null || session.ExpiresAt <= DateTime.UtcNow)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.ResetSessionInvalid);
            }

            // A code is used once: verifying it again must not open a new time window
            if (session.IsOtpVerified)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.OtpAlreadyUsed);
            }

            var maxAttempts = _otpSettings.MaxAttempts > 0 ? _otpSettings.MaxAttempts : 5;
            if (session.FailedAttempts >= maxAttempts)
            {
                _passwordResetStore.Remove(session.SessionId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.ResetSessionInvalid);
            }

            if (!OtpHelper.Matches(session.OtpHash, session.SessionId, request.Otp.Trim()))
            {
                session.FailedAttempts++;
                if (session.FailedAttempts >= maxAttempts)
                {
                    _passwordResetStore.Remove(session.SessionId);
                }
                else
                {
                    _passwordResetStore.Save(session, session.ExpiresAt - DateTime.UtcNow);
                }

                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.InvalidOtp);
            }

            var user = await _userManager.FindByIdAsync(session.UserId);
            if (user == null)
            {
                _passwordResetStore.Remove(session.SessionId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.UserNotFound);
            }

            var now = DateTime.UtcNow;
            session.IsOtpVerified = true;
            session.ResetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            // Give the user a fresh time window to type the new password
            session.ExpiresAt = now.AddMinutes(OtpExpiresInMinutes);
            _passwordResetStore.Save(session, session.ExpiresAt - now);

            return ApiResponse.SuccessResult("OTP verified. You can now set a new password");
        }

        public async Task<ApiResponse> ChangePasswordAsync(string userId, ChangePasswordRequest request)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.UserNotFound);
            }

            if (request.CurrentPassword == request.NewPassword)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.SamePassword);
            }

            if (!string.IsNullOrEmpty(request.ConfirmPassword) && request.NewPassword != request.ConfirmPassword)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.PasswordMismatch);
            }

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToList();
                return ApiResponse.FailureResult("Change password failed", errors);
            }

            // BR-104: sign out other devices; keep this one when FE sends its refresh token.
            if (!string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                var current = await _refreshTokenRepository.GetActiveTokenAsync(request.RefreshToken);
                if (current != null && current.UserId == userId)
                    await _refreshTokenRepository.RevokeUserTokensExceptAsync(userId, request.RefreshToken);
                else
                    await _refreshTokenRepository.RevokeUserTokensAsync(userId);
            }
            else
            {
                await _refreshTokenRepository.RevokeUserTokensAsync(userId);
            }

            await _refreshTokenRepository.SaveChangesAsync();

            return ApiResponse.SuccessResult("Password changed successfully");
        }

        public async Task<ApiResponse> ResetPasswordAsync(ResetPasswordRequest request)
        {
            var session = _passwordResetStore.Get(request.SessionId);
            if (session == null || !session.IsOtpVerified
                || string.IsNullOrEmpty(session.ResetToken) || session.ExpiresAt <= DateTime.UtcNow)
            {
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.ResetSessionInvalid);
            }

            var user = await _userManager.FindByIdAsync(session.UserId);
            if (user == null)
            {
                _passwordResetStore.Remove(session.SessionId);
                return ApiResponse.FailureResult(ErrorConstants.AuthMessage.UserNotFound);
            }

            var result = await _userManager.ResetPasswordAsync(user, session.ResetToken, request.NewPassword);
            if (!result.Succeeded)
            {
                // The session is kept so the user can retry with a password that meets the rules.
                var errors = result.Errors.Select(e => e.Description).ToList();
                return ApiResponse.FailureResult("Reset password failed", errors);
            }

            _passwordResetStore.Remove(session.SessionId);

            // Sign out every device that still holds a refresh token issued with the old password
            await _refreshTokenRepository.RevokeUserTokensAsync(user.Id);
            await _refreshTokenRepository.SaveChangesAsync();

            return ApiResponse.SuccessResult("Password has been reset successfully");
        }
    }
}
