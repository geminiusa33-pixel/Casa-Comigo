using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Housing group use cases with authorization-aware repository operations.</summary>
public interface IHousingGroupService
{
    Task<IReadOnlyList<HousingGroupResponse>> GetMyGroupsAsync(Guid profileId, CancellationToken cancellationToken);
    Task<IReadOnlyList<HousingGroupResponse>> GetDiscoverableGroupsAsync(Guid profileId, CancellationToken cancellationToken);
    Task RenameAsync(Guid profileId, Guid groupId, UpdateHousingGroupNameRequest request, CancellationToken cancellationToken);
    Task LeaveAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<Guid> RequestJoinAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<string> VoteJoinRequestAsync(Guid profileId, Guid requestId, VoteHousingGroupJoinRequest request, CancellationToken cancellationToken);
    Task ConfirmCompletionAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<IReadOnlyList<HousingGroupMessageResponse>> GetMessagesAsync(Guid profileId, Guid groupId, CancellationToken cancellationToken);
    Task<HousingGroupMessageResponse> SendMessageAsync(Guid profileId, Guid groupId, SendMessageRequest request, CancellationToken cancellationToken);
}
