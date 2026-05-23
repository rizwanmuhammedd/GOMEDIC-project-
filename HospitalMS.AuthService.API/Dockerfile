FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HospitalMS.AuthService.API/HospitalMS.AuthService.API.csproj", "HospitalMS.AuthService.API/"]
COPY ["HospitalMS.AuthService.Application/HospitalMS.AuthService.Application.csproj", "HospitalMS.AuthService.Application/"]
COPY ["HospitalMS.AuthService.Domain/HospitalMS.AuthService.Domain.csproj", "HospitalMS.AuthService.Domain/"]
COPY ["HospitalMS.AuthService.Infrastructure/HospitalMS.AuthService.Infrastructure.csproj", "HospitalMS.AuthService.Infrastructure/"]
RUN dotnet restore "./HospitalMS.AuthService.API/HospitalMS.AuthService.API.csproj"
COPY . .
WORKDIR "/src/HospitalMS.AuthService.API"
RUN dotnet build "./HospitalMS.AuthService.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HospitalMS.AuthService.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HospitalMS.AuthService.API.dll"]
