using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Persiste e consulta perfis sem expor coordenadas na descoberta.</summary>
public interface IProfileRepository
{
    Task<ProfileResponse?> GetAsync(Guid profileId, CancellationToken cancellationToken);
    Task<ProfileResponse> SaveAsync(Guid profileId, UpdateProfileRequest request, CancellationToken cancellationToken);
    Task<bool> HasSearchAreaAsync(Guid profileId, CancellationToken cancellationToken);
    Task<ProfileResponse> SaveSearchAreaAsync(Guid profileId, UpdateSearchAreaRequest request, CancellationToken cancellationToken);
}
