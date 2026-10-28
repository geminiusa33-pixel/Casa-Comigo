using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Data access for conversations restricted to their match participants.</summary>
public interface IChatRepository
{
    /// <summary>Loads the latest messages when the user participates in the match.</summary>
    Task<IReadOnlyList<MessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken);

    /// <summary>Sends a message when the user participates in an unblocked match.</summary>
    Task<MessageResponse> SendMessageAsync(
        Guid profileId,
        Guid matchId,
        string body,
        CancellationToken cancellationToken);
}
