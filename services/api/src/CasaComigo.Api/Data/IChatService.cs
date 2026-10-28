using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Business operations for participant-only match conversations.</summary>
public interface IChatService
{
    /// <summary>Gets the latest messages for a match conversation.</summary>
    Task<IReadOnlyList<MessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken);

    /// <summary>Validates and sends a message in a match conversation.</summary>
    Task<MessageResponse> SendMessageAsync(
        Guid profileId,
        Guid matchId,
        SendMessageRequest request,
        CancellationToken cancellationToken);
}
