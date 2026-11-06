FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["services/api/src/CasaComigo.Api/CasaComigo.Api.csproj", "services/api/src/CasaComigo.Api/"]
RUN dotnet restore "services/api/src/CasaComigo.Api/CasaComigo.Api.csproj"

COPY . .
WORKDIR "/src/services/api/src/CasaComigo.Api"
RUN dotnet publish "CasaComigo.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "CasaComigo.Api.dll"]