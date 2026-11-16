using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using OZE.Application.Interfaces;
using OZE.Common.Constants;

namespace OZE.Application.Services
{
    // Keeps the pictures on the server's disk (option A). The root comes from ImagingStorage:RootPath; without it,
    // %HOME%/data/imaging on Azure App Service (kept across deployments) or App_Data/imaging next to the app elsewhere.
    public class LocalImagingFileStore : IImagingFileStore
    {
        private readonly string _root;

        public LocalImagingFileStore(IConfiguration configuration, IHostEnvironment environment)
        {
            _root = Path.GetFullPath(ResolveRoot(configuration, environment));
        }

        public string Root => _root;

        public async Task SaveAsync(string relativePath, byte[] data, CancellationToken cancellationToken = default)
        {
            var fullPath = ToFullPath(relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllBytesAsync(fullPath, data, cancellationToken);
        }

        public async Task<byte[]?> ReadAsync(string relativePath, CancellationToken cancellationToken = default)
        {
            var fullPath = ToFullPath(relativePath);
            return File.Exists(fullPath) ? await File.ReadAllBytesAsync(fullPath, cancellationToken) : null;
        }

        // The full path, refused when it would leave the storage root (for example "../../web.config")
        private string ToFullPath(string relativePath)
        {
            var fullPath = Path.GetFullPath(Path.Combine(_root, relativePath.Replace('\\', '/').TrimStart('/')));
            var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar) ? _root : _root + Path.DirectorySeparatorChar;
            if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("The file path leaves the imaging storage folder.");
            }

            return fullPath;
        }

        private static string ResolveRoot(IConfiguration configuration, IHostEnvironment environment)
        {
            var configured = configuration[ImagingCaptureConstants.StorageRootConfigKey];
            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured;
            }

            // Azure App Service sets WEBSITE_SITE_NAME and HOME
            var home = Environment.GetEnvironmentVariable("HOME");
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WEBSITE_SITE_NAME")) && !string.IsNullOrWhiteSpace(home))
            {
                return Path.Combine(home, ImagingCaptureConstants.AzureStorageFolder);
            }

            return Path.Combine(environment.ContentRootPath, ImagingCaptureConstants.DevelopmentStorageFolder);
        }
    }
}
