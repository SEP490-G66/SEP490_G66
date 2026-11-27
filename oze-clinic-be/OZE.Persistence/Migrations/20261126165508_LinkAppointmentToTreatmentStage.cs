using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkAppointmentToTreatmentStage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TreatmentPlanStageId",
                table: "Appointments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TreatmentPlanStageId",
                table: "Appointments",
                column: "TreatmentPlanStageId",
                filter: "[TreatmentPlanStageId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_TreatmentPlanStages",
                table: "Appointments",
                column: "TreatmentPlanStageId",
                principalTable: "TreatmentPlanStages",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_TreatmentPlanStages",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_TreatmentPlanStageId",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "TreatmentPlanStageId",
                table: "Appointments");
        }
    }
}
