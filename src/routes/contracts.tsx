      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="w-full max-w-[200px]">
            <Label className="mb-1.5 block">Search Unit No</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="e.g. 101"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full max-w-[260px] relative">
            <Label className="mb-1.5 block">Search Tenant</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Type tenant name..."
                value={
                  tenantFilter !== "all"
                    ? tenantMap[tenantFilter] || tenantSearchText
                    : tenantSearchText
                }
                onChange={(e) => {
                  setTenantSearchText(e.target.value);
                  setTenantFilter("all"); // reset selection while typing
                  setTenantOpen(true);
                }}
                onFocus={() => setTenantOpen(true)}
              />
            </div>

            {tenantOpen && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setTenantFilter("all");
                    setTenantSearchText("");
                    setTenantOpen(false);
                  }}
                >
                  All tenants
                </button>
                {data.tenants
                  .filter((t) =>
                    t.name.toLowerCase().includes(tenantSearchText.trim().toLowerCase()),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setTenantFilter(t.id);
                        setTenantSearchText(t.name);
                        setTenantOpen(false);
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                {data.tenants.filter((t) =>
                  t.name.toLowerCase().includes(tenantSearchText.trim().toLowerCase()),
                ).length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No tenant found</div>
                )}
              </div>
            )}
          </div>

          {(unitSearch || tenantFilter !== "all" || tenantSearchText) && (
            <Button
              variant="ghost"
              onClick={() => {
                setUnitSearch("");
                setTenantFilter("all");
                setTenantSearchText("");
                setTenantOpen(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>
