using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Valida e executa operações do perfil autenticado.</summary>
public interface IProfileService
{
    Task<ProfileResponse?> GetAsync(Guid profileId, CancellationToken cancellationToken);
    Task<ProfileResponse> SaveAsync(Guid profileId, UpdateProfileRequest request, CancellationToken cancellationToken);
    Task<ProfileResponse> SaveSearchAreaAsync(Guid profileId, UpdateSearchAreaRequest request, CancellationToken cancellationToken);
}

/// <summary>Erro de validação de uma operação de perfil.</summary>
public sealed class ProfileValidationException(string message) : Exception(message);
