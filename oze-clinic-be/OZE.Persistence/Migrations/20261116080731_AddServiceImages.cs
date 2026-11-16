using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OZE.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ImageUpdatedAt",
                table: "ServiceVariants",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ImageUpdatedAt",
                table: "Services",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServiceImages",
                columns: table => new
                {
                    ServiceId = table.Column<int>(type: "int", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceImages", x => x.ServiceId);
                    table.ForeignKey(
                        name: "FK_ServiceImages_Services",
                        column: x => x.ServiceId,
                        principalTable: "Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceVariantImages",
                columns: table => new
                {
                    ServiceVariantId = table.Column<int>(type: "int", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceVariantImages", x => x.ServiceVariantId);
                    table.ForeignKey(
                        name: "FK_ServiceVariantImages_ServiceVariants",
                        column: x => x.ServiceVariantId,
                        principalTable: "ServiceVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceImages");

            migrationBuilder.DropTable(
                name: "ServiceVariantImages");

            migrationBuilder.DropColumn(
                name: "ImageUpdatedAt",
                table: "ServiceVariants");

            migrationBuilder.DropColumn(
                name: "ImageUpdatedAt",
                table: "Services");
        }
    }
}
