using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCashierPaymentOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "AppointmentId",
                table: "TreatmentPlanStages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DepositRate",
                table: "TreatmentPlans",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentOption",
                table: "TreatmentPlans",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaymentOptionChosenAt",
                table: "TreatmentPlans",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentOptionChosenByUserId",
                table: "TreatmentPlans",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "Payments",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptCode",
                table: "Payments",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TreatmentPlanStageId",
                table: "Payments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentPlanStages_AppointmentId",
                table: "TreatmentPlanStages",
                column: "AppointmentId",
                filter: "[AppointmentId] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TreatmentPlans_DepositRate",
                table: "TreatmentPlans",
                sql: "[DepositRate] IS NULL OR ([DepositRate] >= 0 AND [DepositRate] <= 100)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TreatmentPlans_PaymentOption",
                table: "TreatmentPlans",
                sql: "[PaymentOption] IS NULL OR [PaymentOption] IN ('FULL', 'PERIODS', 'DEPOSIT')");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ReceiptCode",
                table: "Payments",
                column: "ReceiptCode",
                filter: "[ReceiptCode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TreatmentPlanStageId",
                table: "Payments",
                column: "TreatmentPlanStageId",
                filter: "[TreatmentPlanStageId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_CreatedBy",
                table: "Payments",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_TreatmentPlanStages",
                table: "Payments",
                column: "TreatmentPlanStageId",
                principalTable: "TreatmentPlanStages",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TreatmentPlanStages_Appointments",
                table: "TreatmentPlanStages",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id");

            // Deposit rate of the clinic (percent), copied onto a plan when the cashier chooses DEPOSIT
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM SystemConfigurations WHERE ConfigKey = N'Payment.DepositRate')
    INSERT INTO SystemConfigurations (ConfigKey, ConfigValue, DataType, Description)
    VALUES (N'Payment.DepositRate', N'30', N'Decimal', N'Tỉ lệ đặt cọc khi chọn phương án đặt cọc (%)');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM SystemConfigurations WHERE ConfigKey = N'Payment.DepositRate';");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_CreatedBy",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_TreatmentPlanStages",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_TreatmentPlanStages_Appointments",
                table: "TreatmentPlanStages");

            migrationBuilder.DropIndex(
                name: "IX_TreatmentPlanStages_AppointmentId",
                table: "TreatmentPlanStages");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TreatmentPlans_DepositRate",
                table: "TreatmentPlans");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TreatmentPlans_PaymentOption",
                table: "TreatmentPlans");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ReceiptCode",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TreatmentPlanStageId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "AppointmentId",
                table: "TreatmentPlanStages");

            migrationBuilder.DropColumn(
                name: "DepositRate",
                table: "TreatmentPlans");

            migrationBuilder.DropColumn(
                name: "PaymentOption",
                table: "TreatmentPlans");

            migrationBuilder.DropColumn(
                name: "PaymentOptionChosenAt",
                table: "TreatmentPlans");

            migrationBuilder.DropColumn(
                name: "PaymentOptionChosenByUserId",
                table: "TreatmentPlans");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReceiptCode",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TreatmentPlanStageId",
                table: "Payments");
        }
    }
}
