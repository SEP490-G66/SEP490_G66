using OZE.Application.Middlewares;
using OZE.Common.Constants;

namespace OZE.Application.Helpers
{
    public static class PaymentMethodHelper
    {
        // "cash " -> "CASH"; anything that is not a known method is refused
        public static string Normalize(string? method)
        {
            var normalized = method?.Trim().ToUpperInvariant() ?? string.Empty;
            ConditionGuard.Ensure(PaymentConstants.Methods.Contains(normalized), ErrorConstants.PaymentMessage.MethodInvalid);
            return normalized;
        }
    }
}
