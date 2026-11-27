using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStageAssignedDoctor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedDoctorId",
                table: "TreatmentPlanStages",
                type: "int",
                nullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TreatmentPlanStages_AssignedDoctors",
                table: "TreatmentPlanStages",
                column: "AssignedDoctorId",
                principalTable: "StaffProfiles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TreatmentPlanStages_AssignedDoctors",
                table: "TreatmentPlanStages");

            migrationBuilder.DropColumn(
                name: "AssignedDoctorId",
                table: "TreatmentPlanStages");
        }
    }
}
