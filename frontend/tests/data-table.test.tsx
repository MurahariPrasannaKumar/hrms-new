import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ApiError } from "@/lib/api/client";

interface Row { id: string; name: string }
const columns: Column<Row>[] = [{ key: "name", header: "Name", sortable: true }];
const base = { columns, getRowId: (r: Row) => r.id };

describe("DataTable", () => {
  it("renders skeleton rows while loading", () => {
    render(<DataTable {...base} isLoading skeletonRows={3} />);
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
  });

  it("renders the empty state", () => {
    render(<DataTable {...base} data={[]} emptyTitle="No students" />);
    expect(screen.getByText("No students")).toBeInTheDocument();
  });

  it("renders the error state with retry", async () => {
    const retry = vi.fn();
    render(<DataTable {...base} error={new ApiError(500, "X", "Boom")} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });

  it("renders rows, actions, sorting and pagination", async () => {
    const onSort = vi.fn();
    const onPage = vi.fn();
    render(
      <DataTable {...base} data={[{ id: "1", name: "Aarav" }]} total={45} pageSize={20} page={1} onPageChange={onPage} onSortChange={onSort} rowActions={() => <button>Edit</button>} />,
    );
    expect(screen.getByText("Aarav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSort).toHaveBeenCalledWith({ by: "name", order: "asc" });
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });
});
