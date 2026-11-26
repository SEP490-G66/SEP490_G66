namespace OZE.Application.Interfaces
{
    // Access tokens ended before they expire (logout), by their id (jti)
    public interface IAccessTokenRevocationStore
    {
        void Revoke(string tokenId, DateTimeOffset expiresAt);
        // Checked on every signed-in request; async so a Redis round trip does not hold a thread
        Task<bool> IsRevokedAsync(string tokenId, CancellationToken cancellationToken = default);
    }
}
