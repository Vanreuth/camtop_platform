"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/user/useUser";
import type { User } from "@/types/user.types";

export function PaginationDebugger() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, error } = useUsers({ page, limit });

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Pagination Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            Previous
          </Button>
          <Button onClick={() => setPage((p) => p + 1)} disabled={isLoading}>
            Next
          </Button>
          <Button onClick={() => setPage(1)} disabled={page === 1 || isLoading}>
            Reset
          </Button>
        </div>

        {/* Status */}
        <div className="space-y-2 text-sm">
          <div>
            <strong>Status:</strong> {isLoading ? "Loading..." : "Ready"}
          </div>
          <div>
            <strong>Current Page:</strong> {page}
          </div>
          <div>
            <strong>Limit:</strong> {limit}
          </div>
          {error && (
            <div className="text-destructive">
              <strong>Error:</strong> {error.message}
            </div>
          )}
        </div>

        {/* Raw Data */}
        {data && (
          <div className="space-y-2">
            <h4 className="font-semibold">Extracted Data:</h4>
            <div className="text-xs bg-muted p-2 rounded">
              <div>
                <strong>Items Count:</strong> {data.users.length}
              </div>
              <div>
                <strong>Total Items:</strong> {data.pagination.total}
              </div>
              <div>
                <strong>Total Pages:</strong> {data.pagination.totalPages}
              </div>
              <div>
                <strong>Current Page (from API):</strong> {data.pagination.page}
              </div>
              <div>
                <strong>Has Next:</strong>{" "}
                {data.pagination.hasNextPage ? "Yes" : "No"}
              </div>
              <div>
                <strong>Has Previous:</strong>{" "}
                {data.pagination.hasPreviousPage ? "Yes" : "No"}
              </div>
            </div>

            <h4 className="font-semibold mt-4">User List:</h4>
            <div className="text-xs bg-muted p-2 rounded max-h-40 overflow-auto">
              {data.users.map((user: User) => (
                <div key={user.id}>
                  {user.id}. {user.firstName} {user.lastName} (@{user.username})
                </div>
              ))}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer font-semibold">
                Full Response (JSON)
              </summary>
              <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-h-60">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
