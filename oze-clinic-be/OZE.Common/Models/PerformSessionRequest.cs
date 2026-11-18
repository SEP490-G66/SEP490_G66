namespace OZE.Common.Models
{
    // What the doctor records when a treatment session is performed
    public class PerformSessionRequest
    {
        public string? Notes { get; set; }
        // Defaults to the stage's estimated cost; a different cost needs a note
        public decimal? ActualCost { get; set; }
    }
}
