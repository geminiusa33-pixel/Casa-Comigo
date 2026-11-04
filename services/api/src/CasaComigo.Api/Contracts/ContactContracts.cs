using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Mensagem de contacto enviada pelo formulário público.</summary>
public sealed record ContactMessageRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public required string Name { get; init; }

    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, StringLength(5000, MinimumLength = 10)]
    public required string Message { get; init; }
}
