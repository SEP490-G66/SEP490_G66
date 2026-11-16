using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddImagingCaptures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImagingCaptures",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImagingRequestId = table.Column<long>(type: "bigint", nullable: false),
                    TechnicianId = table.Column<int>(type: "int", nullable: false),
                    SimulationId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DeviceId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Modality = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BodyRegion = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ImageCount = table.Column<int>(type: "int", nullable: false),
                    Kv = table.Column<double>(type: "float", nullable: true),
                    Ma = table.Column<double>(type: "float", nullable: true),
                    ExposureSeconds = table.Column<double>(type: "float", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Progress = table.Column<int>(type: "int", nullable: false),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FailureMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "SYSDATETIMEOFFSET()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImagingCaptures", x => x.Id);
                    table.CheckConstraint("CK_ImagingCaptures_Progress", "[Progress] BETWEEN 0 AND 100");
                    table.CheckConstraint("CK_ImagingCaptures_Status", "[Status] IN ('ACCEPTED', 'CAPTURING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')");
                    table.ForeignKey(
                        name: "FK_ImagingCaptures_Requests",
                        column: x => x.ImagingRequestId,
                        principalTable: "ImagingRequests",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ImagingCaptures_Technician",
                        column: x => x.TechnicianId,
                        principalTable: "StaffProfiles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImagingCaptures_RequestId",
                table: "ImagingCaptures",
                column: "ImagingRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ImagingCaptures_SimulationId",
                table: "ImagingCaptures",
                column: "SimulationId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImagingCaptures");
        }
    }
}
