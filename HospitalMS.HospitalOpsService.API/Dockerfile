FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HospitalMS.HospitalOpsService.API/HospitalMS.HospitalOpsService.API.csproj", "HospitalMS.HospitalOpsService.API/"]
COPY ["HospitalMS.HospitalOpsService.Application/HospitalMS.HospitalOpsService.Application.csproj", "HospitalMS.HospitalOpsService.Application/"]
COPY ["HospitalMS.HospitalOpsService.Domain/HospitalMS.HospitalOpsService.Domain.csproj", "HospitalMS.HospitalOpsService.Domain/"]
COPY ["HospitalMS.HospitalOpsService.Infrastructure/HospitalMS.HospitalOpsService.Infrastructure.csproj", "HospitalMS.HospitalOpsService.Infrastructure/"]
RUN dotnet restore "./HospitalMS.HospitalOpsService.API/HospitalMS.HospitalOpsService.API.csproj"
COPY . .
WORKDIR "/src/HospitalMS.HospitalOpsService.API"
RUN dotnet build "./HospitalMS.HospitalOpsService.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HospitalMS.HospitalOpsService.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HospitalMS.HospitalOpsService.API.dll"]
