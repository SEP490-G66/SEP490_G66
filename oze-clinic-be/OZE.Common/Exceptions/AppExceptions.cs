using System.Net;

namespace OZE.Common.Exceptions
{
    public class AppException : Exception
    {
        public HttpStatusCode StatusCode { get; }

        // Stable machine-readable code the client can branch on (sent as "code" in the error response)
        public string? Code { get; }

        public AppException(string message, HttpStatusCode statusCode = HttpStatusCode.BadRequest, string? code = null)
            : base(message)
        {
            StatusCode = statusCode;
            Code = code;
        }
    }

    // The data changed since the client read it; the client reloads and tries again
    public class ConflictException : AppException
    {
        public ConflictException(string message, string? code = null)
            : base(message, HttpStatusCode.Conflict, code)
        {
        }
    }

    public class NotFoundException : AppException
    {
        public NotFoundException(string message) 
            : base(message, HttpStatusCode.NotFound)
        {
        }
    }

    public class BadRequestException : AppException
    {
        public BadRequestException(string message) 
            : base(message, HttpStatusCode.BadRequest)
        {
        }
    }

    public class UnauthorizedException : AppException
    {
        public UnauthorizedException(string message) 
            : base(message, HttpStatusCode.Unauthorized)
        {
        }
    }

    public class TooManyRequestsException : AppException
    {
        public TooManyRequestsException(string message)
            : base(message, HttpStatusCode.TooManyRequests)
        {
        }
    }

    public class ForbiddenException : AppException
    {
        public ForbiddenException(string message) 
            : base(message, HttpStatusCode.Forbidden)
        {
        }
    }
}
