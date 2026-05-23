FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["HospitalMS.ApiGateway/HospitalMS.ApiGateway.csproj", "HospitalMS.ApiGateway/"]
RUN dotnet restore "./HospitalMS.ApiGateway/HospitalMS.ApiGateway.csproj"
COPY . .
WORKDIR "/src/HospitalMS.ApiGateway"
RUN dotnet build "./HospitalMS.ApiGateway.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./HospitalMS.ApiGateway.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HospitalMS.ApiGateway.dll"]
