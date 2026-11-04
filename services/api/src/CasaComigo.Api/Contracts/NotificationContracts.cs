using System.ComponentModel.DataAnnotations;

namespace CasaComigo.Api.Contracts;

/// <summary>Notificação recebida pelo utilizador autenticado.</summary>
public sealed record NotificationResponse(
    Guid Id,
    string Type,
    string Title,
    string Body,
    string ResourceType,
    Guid ResourceId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

/// <summary>Lista recente de notificações e respetiva contagem de não lidas.</summary>
public sealed record NotificationListResponse(
    IReadOnlyList<NotificationResponse> Items,
    int UnreadCount);

/// <summary>Chave pública VAPID usada pelo browser para criar a subscrição push.</summary>
public sealed record PushPublicKeyResponse(string PublicKey);

/// <summary>Subscrição Web Push do browser autenticado.</summary>
public sealed record SavePushSubscriptionRequest
{
    /// <summary>Endpoint único fornecido pelo serviço de push do browser.</summary>
    [Required, Url, StringLength(2048, MinimumLength = 1)]
    public required string Endpoint { get; init; }

    /// <summary>Chave pública ECDH fornecida pelo browser.</summary>
    [Required, StringLength(256, MinimumLength = 1)]
    public required string P256dh { get; init; }

    /// <summary>Segredo de autenticação fornecido pelo browser.</summary>
    [Required, StringLength(256, MinimumLength = 1)]
    public required string Auth { get; init; }
}

/// <summary>Remove a subscrição push do browser autenticado.</summary>
public sealed record DeletePushSubscriptionRequest
{
    /// <summary>Endpoint da subscrição a remover.</summary>
    [Required, Url, StringLength(2048, MinimumLength = 1)]
    public required string Endpoint { get; init; }
}
