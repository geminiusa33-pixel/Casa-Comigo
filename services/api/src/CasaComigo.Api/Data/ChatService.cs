using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ChatService(IChatRepository repository) : IChatService
{
    /// <inheritdoc />
    public Task<IReadOnlyList<MessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid matchId,
        CancellationToken cancellationToken) =>
        repository.GetMessagesAsync(profileId, matchId, cancellationToken);

    /// <inheritdoc />
    public Task<MessageResponse> SendMessageAsync(
        Guid profileId,
        Guid matchId,
        SendMessageRequest request,
        CancellationToken cancellationToken)
    {
        var body = request.Body.Trim();
        if (body.Length == 0)
            throw new ProfileValidationException("A mensagem não pode estar vazia.");

        return repository.SendMessageAsync(profileId, matchId, body, cancellationToken);
    }
}
