using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AppointmentChangeRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppointmentChangeRequests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PatientId = table.Column<int>(type: "int", nullable: false),
                    AppointmentId = table.Column<long>(type: "bigint", nullable: true),
                    TreatmentPlanStageId = table.Column<long>(type: "bigint", nullable: true),
                    RequestType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PreferredTimes = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    HandledByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    HandledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    HandlerNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSDATETIMEOFFSET()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppointmentChangeRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppointmentChangeRequests_Appointments",
                        column: x => x.AppointmentId,
                        principalTable: "Appointments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AppointmentChangeRequests_Patients",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AppointmentChangeRequests_TreatmentPlanStages",
                        column: x => x.TreatmentPlanStageId,
                        principalTable: "TreatmentPlanStages",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppointmentChangeRequests_AppointmentId",
                table: "AppointmentChangeRequests",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AppointmentChangeRequests_PatientId",
                table: "AppointmentChangeRequests",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_AppointmentChangeRequests_Status_CreatedAt",
                table: "AppointmentChangeRequests",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AppointmentChangeRequests_TreatmentPlanStageId",
                table: "AppointmentChangeRequests",
                column: "TreatmentPlanStageId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppointmentChangeRequests");
        }
    }
}
