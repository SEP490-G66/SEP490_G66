namespace OZE.Common.Constants
{
    public static class CashSessionConstants
    {
        public const string Open = "Open";
        public const string Closed = "Closed";

        public static readonly string[] Statuses = { Open, Closed };

        // Kinds of cash paid out of the drawer during a session
        public const string ExpenseSupplies = "Supplies";
        public const string ExpenseOther = "Other";

        public static readonly string[] ExpenseCategories = { ExpenseSupplies, ExpenseOther };

        public const int DescriptionMaxLength = 300;
        public const int NotesMaxLength = 500;

        // Vietnamese banknotes a drawer can be counted in
        public static readonly int[] Denominations = { 500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500 };
        public const int MaxNotesPerDenomination = 9999;

        // Error codes the hand-over screen branches on (reload and count again)
        public const string SessionChangedCode = "SESSION_CHANGED";
        public const string FiguresChangedCode = "FIGURES_CHANGED";
    }
}
