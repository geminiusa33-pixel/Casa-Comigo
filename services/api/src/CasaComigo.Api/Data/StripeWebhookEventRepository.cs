using Npgsql;

namespace CasaComigo.Api.Data;

public sealed class StripeWebhookEventRepository(NpgsqlDataSource dataSource) : IStripeWebhookEventRepository
{
    public async Task<StripeWebhookClaimResult> TryClaimAsync(
        string eventId,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var claimCommand = new NpgsqlCommand(
            """
            insert into public.stripe_webhook_events (stripe_event_id, status, processing_started_at)
            values (@event_id, 'processing', now())
            on conflict (stripe_event_id) do update
              set status = 'processing', processing_started_at = now()
              where public.stripe_webhook_events.status = 'failed'
                 or (public.stripe_webhook_events.status = 'processing'
                     and public.stripe_webhook_events.processing_started_at < now() - interval '10 minutes')
            returning status;
            """,
            connection);
        claimCommand.Parameters.AddWithValue("event_id", eventId);
        var claim = await claimCommand.ExecuteScalarAsync(cancellationToken);
        if (claim is not null)
            return StripeWebhookClaimResult.Claimed;

        await using var statusCommand = new NpgsqlCommand(
            "select status from public.stripe_webhook_events where stripe_event_id = @event_id;",
            connection);
        statusCommand.Parameters.AddWithValue("event_id", eventId);
        var status = (string?)await statusCommand.ExecuteScalarAsync(cancellationToken);
        return status switch
        {
            "processed" => StripeWebhookClaimResult.AlreadyProcessed,
            "processing" => StripeWebhookClaimResult.Processing,
            _ => throw new InvalidOperationException("Stripe webhook event claim was not persisted.")
        };
    }

    public async Task MarkProcessedAsync(string eventId, CancellationToken cancellationToken)
    {
        await UpdateStatusAsync(eventId, "processed", cancellationToken);
    }

    public async Task MarkFailedAsync(string eventId, CancellationToken cancellationToken)
    {
        await UpdateStatusAsync(eventId, "failed", cancellationToken);
    }

    private async Task UpdateStatusAsync(
        string eventId,
        string status,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            """
            update public.stripe_webhook_events
            set status = @status, processed_at = case when @status = 'processed' then now() else null end
            where stripe_event_id = @event_id;
            """,
            connection);
        command.Parameters.AddWithValue("event_id", eventId);
        command.Parameters.AddWithValue("status", status);
        if (await command.ExecuteNonQueryAsync(cancellationToken) != 1)
            throw new InvalidOperationException("Stripe webhook event status update affected no row.");
    }
}
