using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Services;

public sealed class StripeDonationWebhookService(
    IConfiguration configuration,
    IStripeWebhookEventRepository eventRepository,
    IStripeDonationEmailService emailService,
    TimeProvider timeProvider,
    ILogger<StripeDonationWebhookService> logger) : IStripeDonationWebhookService
{
    private static readonly TimeSpan SignatureTolerance = TimeSpan.FromMinutes(5);
    private readonly string? _signingSecret = configuration["Stripe:WebhookSecret"];

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_signingSecret)
        && _signingSecret.StartsWith("whsec_", StringComparison.Ordinal);

    public async Task<StripeWebhookHandlingResult> HandleAsync(
        ReadOnlyMemory<byte> payload,
        string? signatureHeader,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured || !IsSignatureValid(payload.Span, signatureHeader))
            throw new StripeWebhookSignatureException();

        using var eventJson = JsonDocument.Parse(payload);
        var root = eventJson.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new StripeWebhookPayloadException();
        var eventId = GetString(root, "id");
        var eventType = GetString(root, "type");
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(eventType))
            throw new StripeWebhookPayloadException();

        if (eventType is not ("checkout.session.completed" or "checkout.session.async_payment_succeeded"))
            return StripeWebhookHandlingResult.Ignored;

        if (!root.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Object
            || !data.TryGetProperty("object", out var session)
            || session.ValueKind != JsonValueKind.Object)
        {
            throw new StripeWebhookPayloadException();
        }

        if (GetString(session, "object") != "checkout.session"
            || !session.TryGetProperty("metadata", out var metadata)
            || metadata.ValueKind != JsonValueKind.Object
            || GetString(metadata, "purpose") != "donation"
            || GetString(session, "payment_status") != "paid"
            || GetString(session, "currency") != "eur"
            || !session.TryGetProperty("amount_total", out var amountElement)
            || !amountElement.TryGetInt64(out var amountCents)
            || amountCents <= 0)
        {
            return StripeWebhookHandlingResult.Ignored;
        }

        var sessionId = GetString(session, "id");
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new StripeWebhookPayloadException();

        var claim = await eventRepository.TryClaimAsync(eventId, cancellationToken);
        if (claim == StripeWebhookClaimResult.AlreadyProcessed)
            return StripeWebhookHandlingResult.Processed;
        if (claim == StripeWebhookClaimResult.Processing)
            return StripeWebhookHandlingResult.Retry;
        if (!emailService.IsConfigured)
        {
            logger.LogError(
                "Stripe payment was confirmed, but donation email is unavailable. Missing settings: {MissingSettings}",
                string.Join(", ", emailService.MissingSettings));
            await eventRepository.MarkFailedAsync(eventId, cancellationToken);
            return StripeWebhookHandlingResult.Retry;
        }

        var payment = new StripeDonationPayment(
            eventId,
            sessionId,
            amountCents / 100m,
            "EUR");
        try
        {
            await emailService.SendPaymentReceivedAsync(payment, cancellationToken);
        }
        catch (DonationEmailDeliveryException)
        {
            await eventRepository.MarkFailedAsync(eventId, cancellationToken);
            return StripeWebhookHandlingResult.Retry;
        }

        await eventRepository.MarkProcessedAsync(eventId, cancellationToken);
        return StripeWebhookHandlingResult.Processed;
    }

    private bool IsSignatureValid(ReadOnlySpan<byte> payload, string? signatureHeader)
    {
        if (string.IsNullOrWhiteSpace(_signingSecret) || string.IsNullOrWhiteSpace(signatureHeader))
            return false;

        long? timestamp = null;
        var signatures = new List<byte[]>();
        foreach (var part in signatureHeader.Split(','))
        {
            var separator = part.IndexOf('=');
            if (separator <= 0)
                continue;
            var name = part[..separator].Trim();
            var value = part[(separator + 1)..].Trim();
            if (name == "t"
                && long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedTimestamp))
            {
                timestamp = parsedTimestamp;
            }
            else if (name == "v1" && value.Length == 64)
            {
                try
                {
                    signatures.Add(Convert.FromHexString(value));
                }
                catch (FormatException)
                {
                }
            }
        }

        if (timestamp is null || signatures.Count == 0)
            return false;

        DateTimeOffset signedAt;
        try
        {
            signedAt = DateTimeOffset.FromUnixTimeSeconds(timestamp.Value);
        }
        catch (ArgumentOutOfRangeException)
        {
            return false;
        }

        var now = timeProvider.GetUtcNow();
        if (signedAt < now - SignatureTolerance || signedAt > now + SignatureTolerance)
            return false;

        var signedPayload = Encoding.UTF8.GetBytes($"{timestamp.Value}.");
        var bytesToSign = new byte[signedPayload.Length + payload.Length];
        signedPayload.CopyTo(bytesToSign, 0);
        payload.CopyTo(bytesToSign.AsSpan(signedPayload.Length));
        var expectedSignature = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(_signingSecret),
            bytesToSign);
        return signatures.Any(signature =>
            CryptographicOperations.FixedTimeEquals(signature, expectedSignature));
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property)
        && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
}

public sealed class StripeWebhookSignatureException : Exception
{
}

public sealed class StripeWebhookPayloadException : Exception
{
}
