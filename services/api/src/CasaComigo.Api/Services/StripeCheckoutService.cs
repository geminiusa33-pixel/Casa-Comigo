using System.Net.Http.Headers;
using System.Text.Json;

namespace CasaComigo.Api.Services;

public sealed class StripeCheckoutService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    IHostEnvironment environment,
    ILogger<StripeCheckoutService> logger) : IStripeCheckoutService
{
    private const string StripeCheckoutEndpoint = "https://api.stripe.com/v1/checkout/sessions";
    private readonly string? _secretKey = configuration["Stripe:SecretKey"];
    private readonly string? _frontendBaseUrl = configuration["Payments:FrontendBaseUrl"];

    public bool IsConfigured =>
        IsSecretKeyValid(_secretKey) && TryGetFrontendUri(_frontendBaseUrl, out _);

    public IReadOnlyList<string> MissingSettings
    {
        get
        {
            var missing = new List<string>();
            if (!IsSecretKeyValid(_secretKey))
                missing.Add("Stripe__SecretKey");
            if (!TryGetFrontendUri(_frontendBaseUrl, out _))
                missing.Add("Payments__FrontendBaseUrl");
            return missing;
        }
    }

    public async Task<Uri> CreateDonationSessionAsync(
        int amountEuro,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured || !TryGetFrontendUri(_frontendBaseUrl, out var frontendUri))
            throw new InvalidOperationException("Stripe Checkout is not configured.");

        var successUrl = new UriBuilder(frontendUri) { Query = "apoio=concluido" }.Uri;
        var cancelUrl = new UriBuilder(frontendUri) { Query = "apoio=cancelado" }.Uri;
        using var request = new HttpRequestMessage(HttpMethod.Post, StripeCheckoutEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretKey);
        request.Content = new FormUrlEncodedContent(
        [
            new KeyValuePair<string, string>("mode", "payment"),
            new KeyValuePair<string, string>("success_url", successUrl.ToString()),
            new KeyValuePair<string, string>("cancel_url", cancelUrl.ToString()),
            new KeyValuePair<string, string>("locale", "pt"),
            new KeyValuePair<string, string>("allowed_payment_method_types[0]", "card"),
            new KeyValuePair<string, string>("allowed_payment_method_types[1]", "mb_way"),
            new KeyValuePair<string, string>("allowed_payment_method_types[2]", "multibanco"),
            new KeyValuePair<string, string>("line_items[0][price_data][currency]", "eur"),
            new KeyValuePair<string, string>("line_items[0][price_data][unit_amount]", (amountEuro * 100).ToString()),
            new KeyValuePair<string, string>("line_items[0][price_data][product_data][name]", "Apoio ao Divide Casa Comigo"),
            new KeyValuePair<string, string>("line_items[0][quantity]", "1"),
            new KeyValuePair<string, string>("metadata[purpose]", "donation")
        ]);

        HttpResponseMessage response;
        try
        {
            response = await httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Stripe Checkout could not be reached.");
            throw new StripeCheckoutException();
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var requestId = response.Headers.TryGetValues("Request-Id", out var requestIds)
                    ? requestIds.FirstOrDefault()
                    : null;
                logger.LogError(
                    "Stripe Checkout session creation failed with status {StatusCode}; Stripe request ID: {RequestId}",
                    (int)response.StatusCode,
                    requestId);
                throw new StripeCheckoutException();
            }

            try
            {
                await using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var json = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken);
                var checkoutUrlValue = json.RootElement.TryGetProperty("url", out var urlElement)
                    ? urlElement.GetString()
                    : null;
                if (!Uri.TryCreate(checkoutUrlValue, UriKind.Absolute, out var checkoutUrl)
                    || checkoutUrl.Scheme != Uri.UriSchemeHttps
                    || !string.Equals(checkoutUrl.Host, "checkout.stripe.com", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogError("Stripe Checkout returned a missing or unexpected session URL.");
                    throw new StripeCheckoutException();
                }

                return checkoutUrl;
            }
            catch (JsonException exception)
            {
                logger.LogError(exception, "Stripe Checkout returned an invalid response.");
                throw new StripeCheckoutException();
            }
        }
    }

    private bool TryGetFrontendUri(string? value, out Uri uri)
    {
        uri = null!;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var parsedUri)
            || (parsedUri.Scheme != Uri.UriSchemeHttps
                && !(environment.IsDevelopment() && parsedUri.Scheme == Uri.UriSchemeHttp))
            || parsedUri.AbsolutePath != "/"
            || !string.IsNullOrEmpty(parsedUri.Query)
            || !string.IsNullOrEmpty(parsedUri.Fragment))
        {
            return false;
        }

        uri = parsedUri;
        return true;
    }

    private static bool IsSecretKeyValid(string? secretKey) =>
        !string.IsNullOrWhiteSpace(secretKey)
        && (secretKey.StartsWith("sk_test_", StringComparison.Ordinal)
            || secretKey.StartsWith("sk_live_", StringComparison.Ordinal));
}
