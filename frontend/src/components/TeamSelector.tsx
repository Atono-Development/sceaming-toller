import React from 'react';
import { useTeams } from '../contexts/TeamContext';

export const TeamSelector: React.FC = () => {
  const { teams, currentTeam, setCurrentTeam, isLoading } = useTeams();

  if (isLoading) {
    return (
      <div className="h-10 w-48 bg-slate-200 animate-pulse rounded border border-slate-300"></div>
    );
  }

  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block w-64">
      <select
        value={currentTeam?.id || ''}
        onChange={(e) => {
          const team = teams.find((t) => t.id === e.target.value);
          setCurrentTeam(team || null);
        }}
        className="block w-full bg-white border border-slate-300 rounded-md py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
        }}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} {team.isActive ? '' : '(Inactive)'}
          </option>
        ))}
      </select>
    </div>
  );
};
