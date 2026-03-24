import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamContext } from '../contexts/TeamContext';

export const TeamSelector: React.FC = () => {
  const { teams, currentTeam, setCurrentTeam, isLoading } = useTeamContext();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-10 w-48 bg-slate-200 animate-pulse rounded border border-slate-300"></div>
    );
  }

  return (
    <div className="relative inline-block w-full">
      <select
        value={currentTeam?.id || ''}
        onChange={(e) => {
          if (e.target.value === 'create') {
            navigate('/teams/create');
            return;
          }
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
        <option value="" disabled>
          {teams.length === 0 ? 'No teams joined' : 'Select a team'}
        </option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} {team.isActive ? '' : '(Inactive)'}
          </option>
        ))}
        <hr className="my-1" />
        <option value="create" className="font-semibold text-indigo-600">
          + Create New Team
        </option>
      </select>
    </div>
  );
};
