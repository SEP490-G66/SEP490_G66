using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReceptionCashierGaps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProcessedByUserId",
                table: "RefundAdjustmentRequests",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CountedTransfer",
                table: "CashSessions",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Denominations",
                table: "CashSessions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundPaidOut",
                table: "CashSessions",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TransferDifference",
                table: "CashSessions",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PriorityReason",
                table: "Appointments",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RefundAdjustments_ProcessedBy",
                table: "RefundAdjustmentRequests",
                column: "ProcessedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RefundAdjustments_ProcessedBy",
                table: "RefundAdjustmentRequests");

            migrationBuilder.DropColumn(
                name: "ProcessedByUserId",
                table: "RefundAdjustmentRequests");

            migrationBuilder.DropColumn(
                name: "CountedTransfer",
                table: "CashSessions");

            migrationBuilder.DropColumn(
                name: "Denominations",
                table: "CashSessions");

            migrationBuilder.DropColumn(
                name: "RefundPaidOut",
                table: "CashSessions");

            migrationBuilder.DropColumn(
                name: "TransferDifference",
                table: "CashSessions");

            migrationBuilder.DropColumn(
                name: "PriorityReason",
                table: "Appointments");
        }
    }
}
