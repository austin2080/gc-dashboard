export interface TeamMember {
  role: string;
  name: string;
  email: string;
  office?: string;
  mobile?: string;
}

export default function ProjectTeamTable({
  teamMembers,
}: {
  teamMembers: TeamMember[];
}) {
  return (
    <section className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Project Team</h2>
        <button
          type="button"
          className="rounded border border-black/30 px-3 py-1 text-sm hover:bg-black/5"
        >
          Edit
        </button>
      </div>
      {teamMembers.length === 0 ? (
        <div className="text-sm opacity-70">
          No team members assigned yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Office</th>
                <th className="px-3 py-2 text-left font-semibold">Mobile</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member, idx) => (
                <tr
                  key={`${member.name}-${idx}`}
                  className="border-b border-black/5 hover:bg-black/2"
                >
                  <td className="px-3 py-3 font-medium">{member.role}</td>
                  <td className="px-3 py-3">{member.name}</td>
                  <td className="px-3 py-3">
                    <a
                      href={`mailto:${member.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {member.email}
                    </a>
                  </td>
                  <td className="px-3 py-3">{member.office || "-"}</td>
                  <td className="px-3 py-3">{member.mobile || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
