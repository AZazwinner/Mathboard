//  where my docs will go; Shared with me, Owned, All;
// - also filters by alpha asc/desc, time asc/desc

"use client";

import { useRouter } from "next/navigation";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useState } from "react";
import { Document } from "@/hooks/useDocs";
import { SortingState } from "@tanstack/react-table";

type Props = {
  docs: Document[];
};

export default function ListDocsShared({ docs }: Props) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  console.log({docs})

  const columns: ColumnDef<Document>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="text-sm font-medium truncate">
          {row.original.title || "Untitled"}
        </div>
      ),
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: ({ row }) => (
        <div className="text-sm font-medium truncate">
          {row.original.owner_username || "Unkown"}
        </div>
      ),
    },
    {
      accessorKey: "permission",
      header: "Permission",
      cell: ({ row }) => (
        <div className="text-sm font-medium truncate">
          {row.original.permission || ""}
        </div>
      ),
    },
    {
      accessorKey: "updated_at",
      header: "Last edited",
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.updated_at
            ? new Date(row.original.updated_at).toLocaleDateString()
            : ""}
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created at",
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.created_at
            ? new Date(row.original.created_at).toLocaleDateString()
            : ""}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: docs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!docs.length) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No documents yet
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="grid grid-cols-5 px-3 py-2 text-xs text-muted-foreground border-b">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="cursor-pointer select-none"
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(
                header.column.columnDef.header,
                header.getContext()
              )}
              {{
                asc: " ↑",
                desc: " ↓",
              }[header.column.getIsSorted() as string] ?? ""}
            </div>
          ))
        )}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            onClick={() => router.push(`/docs/d/${row.original.id}`)}
            className="grid grid-cols-5 px-3 py-2 hover:bg-muted cursor-pointer transition-colors"
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id}>
                {flexRender(
                  cell.column.columnDef.cell,
                  cell.getContext()
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}