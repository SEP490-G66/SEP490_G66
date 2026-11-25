# =======================================================
# Stage 1: Build & Publish (.NET 10 SDK)
# =======================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/OZE.XRaySimulator/OZE.XRaySimulator.csproj src/OZE.XRaySimulator/

RUN dotnet restore src/OZE.XRaySimulator/OZE.XRaySimulator.csproj

COPY src/OZE.XRaySimulator/ src/OZE.XRaySimulator/

WORKDIR /src/src/OZE.XRaySimulator

RUN dotnet publish OZE.XRaySimulator.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# =======================================================
# Stage 2: Runtime Image (ASP.NET Core 10 Runtime)
# =======================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install curl for health checks
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

ENV ASPNETCORE_HTTP_PORTS=8080

COPY --from=build /app/publish .

# Ensure sample image storage is writable
RUN mkdir -p /app/Assets/Samples \
    && chown -R app:app /app/Assets

USER app

ENTRYPOINT ["dotnet", "OZE.XRaySimulator.dll"]
