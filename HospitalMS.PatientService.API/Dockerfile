FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HospitalMS.PatientService.API/HospitalMS.PatientService.API.csproj", "HospitalMS.PatientService.API/"]
COPY ["HospitalMS.PatientService.Application/HospitalMS.PatientService.Application.csproj", "HospitalMS.PatientService.Application/"]
COPY ["HospitalMS.PatientService.Domain/HospitalMS.PatientService.Domain.csproj", "HospitalMS.PatientService.Domain/"]
COPY ["HospitalMS.PatientService.Infrastructure/HospitalMS.PatientService.Infrastructure.csproj", "HospitalMS.PatientService.Infrastructure/"]
RUN dotnet restore "./HospitalMS.PatientService.API/HospitalMS.PatientService.API.csproj"
COPY . .
WORKDIR "/src/HospitalMS.PatientService.API"
RUN dotnet build "./HospitalMS.PatientService.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HospitalMS.PatientService.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HospitalMS.PatientService.API.dll"]
