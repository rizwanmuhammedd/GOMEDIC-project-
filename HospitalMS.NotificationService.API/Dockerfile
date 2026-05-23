FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HospitalMS.NotificationService.API/HospitalMS.NotificationService.API.csproj", "HospitalMS.NotificationService.API/"]
COPY ["HospitalMS.NotificationService.Application/HospitalMS.NotificationService.Application.csproj", "HospitalMS.NotificationService.Application/"]
COPY ["HospitalMS.NotificationService.Domain/HospitalMS.NotificationService.Domain.csproj", "HospitalMS.NotificationService.Domain/"]
COPY ["HospitalMS.NotificationService.Infrastructure/HospitalMS.NotificationService.Infrastructure.csproj", "HospitalMS.NotificationService.Infrastructure/"]
RUN dotnet restore "./HospitalMS.NotificationService.API/HospitalMS.NotificationService.API.csproj"
COPY . .
WORKDIR "/src/HospitalMS.NotificationService.API"
RUN dotnet build "./HospitalMS.NotificationService.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HospitalMS.NotificationService.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HospitalMS.NotificationService.API.dll"]
