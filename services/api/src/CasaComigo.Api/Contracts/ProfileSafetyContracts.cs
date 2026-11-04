using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Perfil que a conta autenticada bloqueou.</summary>
public sealed record BlockedProfileResponse(
    Guid ProfileId,
    string DisplayName,
    DateTimeOffset BlockedAt);

/// <summary>Pedido para denunciar um perfil.</summary>
public sealed record CreateProfileReportRequest
{
    /// <summary>Motivo da denúncia, com pelo menos cinco e no máximo mil caracteres.</summary>
    [Required, StringLength(1000, MinimumLength = 5)]
    public required string Reason { get; init; }
}

/// <summary>Confirmação de que uma denúncia foi registada.</summary>
public sealed record ProfileReportResponse(Guid Id, DateTimeOffset SubmittedAt);
