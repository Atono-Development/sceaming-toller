import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface TeamRequest {
  id: string;
  name: string;
  description: string;
  league: string;
  season: string;
  status: string;
  createdAt: string;
}

export const AdminTeamsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/admin/teams/pending');
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch team requests', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (teamId: string) => {
    try {
      await api.post(`/admin/teams/${teamId}/approve`);
      fetchRequests();
    } catch (error) {
      console.error('Failed to approve team', error);
      alert('Failed to approve team');
    }
  };

  const handleReject = async (teamId: string) => {
    try {
      if (confirm('Are you sure you want to reject this team request?')) {
        await api.post(`/admin/teams/${teamId}/reject`);
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to reject team', error);
      alert('Failed to reject team');
    }
  };

  if (!user?.isSuperAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Requests</h1>
          <p className="text-slate-500 mt-1">Manage new team creation approvals</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-indigo-200 text-indigo-700 bg-indigo-50">
          Super Admin
        </Badge>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-500 mt-4">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-500 text-lg">No pending team requests.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => (
            <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl text-indigo-900">{request.name}</CardTitle>
                <CardDescription>{request.league} - {request.season}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm line-clamp-3">
                  {request.description || 'No description provided.'}
                </p>
                <div className="mt-4 text-xs text-slate-400">
                  Requested on {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 pt-2 border-t border-slate-100">
                <Button 
                  onClick={() => handleApprove(request.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleReject(request.id)}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  Reject
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
