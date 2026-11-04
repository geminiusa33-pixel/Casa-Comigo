namespace CasaComigo.Api.Contracts;

/// <summary>Parses and combines the supported monthly rent contribution ranges.</summary>
public static class RentContributionRanges
{
    /// <summary>Returns the lower and upper bounds for a supported range.</summary>
    public static (decimal Minimum, decimal Maximum)? GetBounds(string? range) =>
        range switch
        {
            "200-300" => (200m, 300m),
            "301-400" => (301m, 400m),
            "401-500" => (401m, 500m),
            "501-600" => (501m, 600m),
            _ => null
        };

    /// <summary>Sums ranges when every contributor has selected a supported range.</summary>
    public static (decimal Minimum, decimal Maximum)? Sum(IEnumerable<string?> ranges)
    {
        decimal minimum = 0;
        decimal maximum = 0;
        var count = 0;

        foreach (var range in ranges)
        {
            var bounds = GetBounds(range);
            if (bounds is null)
                return null;

            minimum += bounds.Value.Minimum;
            maximum += bounds.Value.Maximum;
            count++;
        }

        return count == 0 ? null : (minimum, maximum);
    }
}
