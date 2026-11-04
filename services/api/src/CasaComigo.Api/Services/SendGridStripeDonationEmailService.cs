using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Services;

public sealed class SendGridStripeDonationEmailService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<SendGridStripeDonationEmailService> logger) : IStripeDonationEmailService
{
    private readonly string? _apiKey = configuration["SendGrid:ApiKey"];
    private readonly string? _fromEmail = configuration["SendGrid:FromEmail"];
    private readonly string? _toEmail = configuration["Contact:ToEmail"];
    private readonly string _fromName = configuration["SendGrid:FromName"] ?? "Divide Casa Comigo";

    public bool IsConfigured => MissingSettings.Count == 0;

    public IReadOnlyList<string> MissingSettings
    {
        get
        {
            var missing = new List<string>(3);
            if (string.IsNullOrWhiteSpace(_apiKey))
                missing.Add("SendGrid__ApiKey");
            if (string.IsNullOrWhiteSpace(_fromEmail))
                missing.Add("SendGrid__FromEmail");
            if (string.IsNullOrWhiteSpace(_toEmail))
                missing.Add("Contact__ToEmail");
            return missing;
        }
    }

    public async Task SendPaymentReceivedAsync(
        StripeDonationPayment payment,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Donation email delivery was called before configuration was validated.");

        var payload = new
        {
            personalizations = new[] { new { to = new[] { new { email = _toEmail } } } },
            from = new { email = _fromEmail, name = _fromName },
            subject = $"Novo apoio recebido — Divide Casa Comigo ({payment.AmountEuro:0.00} €)",
            content = new[]
            {
                new
                {
                    type = "text/plain",
                    value = $"Foi confirmado um donativo de {payment.AmountEuro:0.00} {payment.Currency.ToUpperInvariant()}.\n"
                        + $"Stripe Checkout Session: {payment.CheckoutSessionId}\n"
                        + $"Stripe Event: {payment.EventId}\n"
                }
            }
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
                return;

            logger.LogError(
                "SendGrid rejected Stripe donation notification with status {StatusCode}.",
                (int)response.StatusCode);
            throw new DonationEmailDeliveryException();
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "SendGrid could not deliver a Stripe donation notification.");
            throw new DonationEmailDeliveryException();
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "SendGrid timed out while delivering a Stripe donation notification.");
            throw new DonationEmailDeliveryException();
        }
    }
}

public sealed class DonationEmailDeliveryException : Exception
{
}
