# =======================================================
# Stage 1: Build & Publish (.NET 10 SDK)
# =======================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy only the Web API and the projects it references, so the test project in OZE.sln is not needed
COPY OZE/OZE.csproj OZE/
COPY OZE.Application/OZE.Application.csproj OZE.Application/
COPY OZE.Common/OZE.Common.csproj OZE.Common/
COPY OZE.Domain/OZE.Domain.csproj OZE.Domain/
COPY OZE.Persistence/OZE.Persistence.csproj OZE.Persistence/

# Restore dependencies
RUN dotnet restore OZE/OZE.csproj

# Copy the remaining project source files
COPY . .

# Build and publish Web API
WORKDIR /src/OZE
RUN dotnet publish OZE.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# =======================================================
# Stage 2: Runtime Image (ASP.NET Core 10 Runtime)
# =======================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

# Folder for uploaded imaging files; mount a volume here so they survive a rebuild
ENV ImagingStorage__RootPath=/app/data/imaging
RUN mkdir -p /app/data/imaging && chown -R app:app /app/data

# Run under secure non-root user provided by .NET 10
USER app

ENTRYPOINT ["dotnet", "OZE.dll"]
