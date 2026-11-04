using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class HousingGroupService(IHousingGroupRepository repository) : IHousingGroupService
{
    /// <inheritdoc />
    public Task<IReadOnlyList<HousingGroupResponse>> GetMyGroupsAsync(Guid profileId, CancellationToken cancellationToken) =>
        repository.GetMyGroupsAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public Task<IReadOnlyList<HousingGroupResponse>> GetDiscoverableGroupsAsync(Guid profileId, CancellationToken cancellationToken) =>
        repository.GetDiscoverableGroupsAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public async Task RenameAsync(Guid profileId, Guid groupId, UpdateHousingGroupNameRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length == 0 || name.Length > 80)
            throw new ProfileValidationException("O nome do grupo deve ter entre 1 e 80 caracteres.");
        if (!await repository.RenameAsync(profileId, groupId, name, cancellationToken))
            throw new ChatNotFoundException();
    }

    /// <inheritdoc />
    public async Task LeaveAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken)
    {
        if (!await repository.LeaveAsync(profileId, groupId, cancellationToken))
            throw new ChatNotFoundException();
    }

    /// <inheritdoc />
    public Task<Guid> RequestJoinAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken) =>
        repository.RequestJoinAsync(profileId, groupId, cancellationToken);

    /// <inheritdoc />
    public async Task<string> VoteJoinRequestAsync(
        Guid profileId,
        Guid requestId,
        VoteHousingGroupJoinRequest request,
        CancellationToken cancellationToken)
    {
        var result = await repository.VoteJoinRequestAsync(profileId, requestId, request.Accept, cancellationToken);
        if (result == "unavailable")
            throw new ChatNotFoundException();
        return result;
    }

    /// <inheritdoc />
    public async Task ConfirmCompletionAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken)
    {
        if (!await repository.ConfirmCompletionAsync(profileId, groupId, cancellationToken))
            throw new ChatNotFoundException();
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<HousingGroupMessageResponse>> GetMessagesAsync(
        Guid profileId,
        Guid groupId,
        CancellationToken cancellationToken) =>
        repository.GetMessagesAsync(profileId, groupId, cancellationToken);

    /// <inheritdoc />
    public Task<HousingGroupMessageResponse> SendMessageAsync(
        Guid profileId,
        Guid groupId,
        SendMessageRequest request,
        CancellationToken cancellationToken)
    {
        var body = request.Body.Trim();
        if (body.Length == 0 || body.Length > 4000)
            throw new ProfileValidationException("A mensagem deve ter entre 1 e 4000 caracteres.");

        return repository.SendMessageAsync(profileId, groupId, body, cancellationToken);
    }
}
