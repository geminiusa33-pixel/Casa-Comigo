using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Pedido para enviar uma mensagem numa conversa de match.</summary>
public sealed record SendMessageRequest
{
    /// <summary>Texto da mensagem, com um máximo de 4000 caracteres.</summary>
    [Required, StringLength(4000, MinimumLength = 1)]
    public required string Body { get; init; }
}

/// <summary>Mensagem enviada por um dos participantes de um match.</summary>
public sealed record MessageResponse(
    Guid Id,
    Guid MatchId,
    Guid SenderId,
    string Body,
    DateTimeOffset SentAt);
