using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Data access for housing groups, unanimous decisions, and group conversations.</summary>
public interface IHousingGroupRepository
{
    Task<IReadOnlyList<HousingGroupResponse>> GetMyGroupsAsync(Guid profileId, CancellationToken cancellationToken);
    Task<IReadOnlyList<HousingGroupResponse>> GetDiscoverableGroupsAsync(Guid profileId, CancellationToken cancellationToken);
    Task<bool> RenameAsync(Guid profileId, Guid groupId, string name, CancellationToken cancellationToken);
    Task<bool> LeaveAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<Guid> RequestJoinAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<string> VoteJoinRequestAsync(Guid profileId, Guid requestId, bool accept, CancellationToken cancellationToken);
    Task<bool> ConfirmCompletionAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<IReadOnlyList<HousingGroupMessageResponse>> GetMessagesAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<HousingGroupMessageResponse> SendMessageAsync(Guid profileId, Guid groupId, string body, CancellationToken cancellationToken);
}
