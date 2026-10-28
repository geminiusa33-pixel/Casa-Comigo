using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Safety actions available to an authenticated profile.</summary>
public interface IProfileSafetyService
{
    /// <summary>Blocks another profile.</summary>
    Task BlockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken);

    /// <summary>Removes a block created by the current profile.</summary>
    Task UnblockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken);

    /// <summary>Lists profiles blocked by the current profile.</summary>
    Task<IReadOnlyList<BlockedProfileResponse>> GetBlockedProfilesAsync(
        Guid blockerId,
        CancellationToken cancellationToken);

    /// <summary>Validates and submits a report about another profile.</summary>
    Task<ProfileReportResponse> ReportAsync(
        Guid reporterId,
        Guid reportedId,
        CreateProfileReportRequest request,
        CancellationToken cancellationToken);
}
