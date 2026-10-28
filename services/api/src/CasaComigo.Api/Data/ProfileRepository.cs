using CasaComigo.Api.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ProfileRepository(NpgsqlDataSource dataSource) : IProfileRepository
{
    /// <inheritdoc />
    public async Task<ProfileResponse?> GetAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = ProfileQuery;
        command.Parameters.AddWithValue(profileId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadProfile(reader) : null;
    }

    /// <inheritdoc />
    public async Task<ProfileResponse> SaveAsync(
        Guid profileId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                insert into public.profiles (
                    id, display_name, bio, preferred_housemates, gender_preference,
                    has_pets, interests, opinions, work_schedule, cooking_habits,
                    rent_contribution_range, lease_holder_preference, bills_preference,
                    furnished_preference, preferred_bathrooms, preferred_bedrooms,
                    home_type_preference, move_in_timing, minimum_lease_months,
                    discovery_visible
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                on conflict (id) do update set
                    display_name = excluded.display_name,
                    bio = excluded.bio,
                    preferred_housemates = excluded.preferred_housemates,
                    gender_preference = excluded.gender_preference,
                    has_pets = excluded.has_pets,
                    interests = excluded.interests,
                    opinions = excluded.opinions,
                    work_schedule = excluded.work_schedule,
                    cooking_habits = excluded.cooking_habits,
                    rent_contribution_range = excluded.rent_contribution_range,
                    lease_holder_preference = excluded.lease_holder_preference,
                    bills_preference = excluded.bills_preference,
                    furnished_preference = excluded.furnished_preference,
                    preferred_bathrooms = excluded.preferred_bathrooms,
                    preferred_bedrooms = excluded.preferred_bedrooms,
                    home_type_preference = excluded.home_type_preference,
                    move_in_timing = excluded.move_in_timing,
                    minimum_lease_months = excluded.minimum_lease_months,
                    discovery_visible = excluded.discovery_visible
                """;
            command.Parameters.AddWithValue(profileId);
            command.Parameters.AddWithValue(request.DisplayName);
            command.Parameters.AddWithValue(request.Bio.Trim());
            command.Parameters.AddWithValue((short)request.PreferredHousemates);
            command.Parameters.AddWithValue(request.GenderPreference);
            command.Parameters.AddWithValue(request.HasPets);
            command.Parameters.Add(new NpgsqlParameter<string[]>
            {
                NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Text,
                Value = request.Interests
            });
            command.Parameters.AddWithValue(request.Opinions.Trim());
            command.Parameters.AddWithValue(request.WorkSchedule.Trim());
            command.Parameters.AddWithValue(request.CookingHabits.Trim());
            command.Parameters.AddWithValue(request.RentContributionRange);
            command.Parameters.AddWithValue(request.LeaseHolderPreference);
            command.Parameters.AddWithValue(request.BillsPreference);
            command.Parameters.AddWithValue(request.FurnishedPreference);
            command.Parameters.Add(new NpgsqlParameter
            {
                NpgsqlDbType = NpgsqlDbType.Smallint,
                Value = request.PreferredBathrooms is int bathrooms ? (object)(short)bathrooms : DBNull.Value
            });
            command.Parameters.Add(new NpgsqlParameter
            {
                NpgsqlDbType = NpgsqlDbType.Smallint,
                Value = request.PreferredBedrooms is int bedrooms ? (object)(short)bedrooms : DBNull.Value
            });
            command.Parameters.AddWithValue(request.HomeTypePreference);
            command.Parameters.AddWithValue(request.MoveInTiming);
            command.Parameters.Add(new NpgsqlParameter
            {
                NpgsqlDbType = NpgsqlDbType.Smallint,
                Value = request.MinimumLeaseMonths is int leaseMonths ? (object)(short)leaseMonths : DBNull.Value
            });
            command.Parameters.AddWithValue(request.DiscoveryVisible);
            try
            {
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            catch (PostgresException exception) when (exception.SqlState == "P0001")
            {
                throw new ProfileValidationException(exception.MessageText);
            }
        }

        return await GetAsync(profileId, cancellationToken)
            ?? throw new InvalidOperationException("O perfil atualizado deixou de existir.");
    }

    /// <inheritdoc />
    public async Task<bool> HasSearchAreaAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "select exists (select 1 from public.search_areas where profile_id = $1)";
        command.Parameters.AddWithValue(profileId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("Não foi possível verificar a zona de procura."));
    }

    /// <inheritdoc />
    public async Task<ProfileResponse> SaveSearchAreaAsync(
        Guid profileId,
        UpdateSearchAreaRequest request,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                insert into public.search_areas (
                    profile_id, latitude, longitude, radius_km, area_label,
                    location_source, location_consent_at
                )
                values (
                    $1, $2, $3, $4, $5, $6,
                    case when $6 = 'gps' then now() else null end
                )
                on conflict (profile_id) do update set
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    radius_km = excluded.radius_km,
                    area_label = excluded.area_label,
                    location_source = excluded.location_source,
                    location_consent_at = excluded.location_consent_at
                """;
            command.Parameters.AddWithValue(profileId);
            command.Parameters.AddWithValue(NpgsqlDbType.Numeric, (decimal)request.Latitude);
            command.Parameters.AddWithValue(NpgsqlDbType.Numeric, (decimal)request.Longitude);
            command.Parameters.AddWithValue(NpgsqlDbType.Numeric, (decimal)request.RadiusKm);
            command.Parameters.AddWithValue(request.AreaLabel);
            command.Parameters.AddWithValue(request.LocationSource);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        return await GetAsync(profileId, cancellationToken)
            ?? throw new InvalidOperationException("O perfil associado à zona de procura não existe.");
    }

    private const string ProfileQuery = """
        select p.id, p.display_name, p.bio, p.preferred_housemates, p.gender_preference,
               p.has_pets, p.interests, p.opinions, p.work_schedule, p.cooking_habits,
               p.rent_contribution_range, p.lease_holder_preference, p.bills_preference,
               p.furnished_preference, p.preferred_bathrooms, p.preferred_bedrooms,
               p.home_type_preference, p.move_in_timing, p.minimum_lease_months,
               p.discovery_visible, p.updated_at, sa.latitude, sa.longitude,
               sa.radius_km, sa.area_label, sa.location_source, sa.updated_at,
               photo.storage_object_path
        from public.profiles p
        left join public.search_areas sa on sa.profile_id = p.id
        left join lateral (
            select storage_object_path
            from public.profile_photos
            where profile_id = p.id
            order by display_order, created_at desc
            limit 1
        ) photo on true
        where p.id = $1
        """;

    private static ProfileResponse ReadProfile(NpgsqlDataReader reader)
    {
        var hasArea = !reader.IsDBNull(21);
        var searchArea = hasArea
            ? new SearchAreaResponse(
                (double)reader.GetDecimal(21),
                (double)reader.GetDecimal(22),
                (double)reader.GetDecimal(23),
                reader.GetString(24),
                reader.GetString(25),
                ToDateTimeOffset(reader.GetDateTime(26)))
            : null;

        var displayName = reader.GetString(1);
        int? preferredHousemates = reader.IsDBNull(3) ? null : reader.GetInt16(3);
        return new ProfileResponse(
            reader.GetGuid(0),
            displayName,
            reader.GetString(2),
            preferredHousemates,
            reader.GetString(4),
            reader.GetBoolean(5),
            reader.GetFieldValue<string[]>(6),
            reader.GetString(7),
            reader.GetString(8),
            reader.GetString(9),
            reader.IsDBNull(10) ? null : reader.GetString(10),
            reader.GetString(11),
            reader.GetString(12),
            reader.GetString(13),
            reader.IsDBNull(14) ? null : reader.GetInt16(14),
            reader.IsDBNull(15) ? null : reader.GetInt16(15),
            reader.GetString(16),
            reader.GetString(17),
            reader.IsDBNull(18) ? null : reader.GetInt16(18),
            reader.GetBoolean(19),
            displayName.Length >= 2 && preferredHousemates is not null && !reader.IsDBNull(10) && hasArea,
            searchArea,
            reader.IsDBNull(27) ? null : reader.GetString(27),
            ToDateTimeOffset(reader.GetDateTime(20)));
    }

    private static DateTimeOffset ToDateTimeOffset(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
