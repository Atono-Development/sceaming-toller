import React, { useState, useRef } from "react";
import { Upload, X, ImageIcon, Trash2 } from "lucide-react";
import { useTeamContext } from "../contexts/TeamContext";
import { uploadTeamLogo, deleteTeamLogo } from "../api/teams";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";

export function LogoUpload() {
  const { currentTeam, refreshTeams } = useTeamContext();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentTeam) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select a file smaller than 5MB.",
      });
      return;
    }

    // Validate type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Only PNG, JPEG, and SVG files are allowed.",
      });
      return;
    }

    // Create local preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !currentTeam) return;

    setIsUploading(true);
    try {
      await uploadTeamLogo(currentTeam.id, file);
      await refreshTeams();
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Logo uploaded",
        description: "Your team logo has been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Something went wrong while uploading your logo.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentTeam || !confirm("Are you sure you want to remove the team logo?")) return;

    setIsUploading(true);
    try {
      await deleteTeamLogo(currentTeam.id);
      await refreshTeams();
      setPreviewUrl(null);
      toast({
        title: "Logo removed",
        description: "The team logo has been removed.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Removal failed",
        description: "Could not remove the logo.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const currentLogo = currentTeam.logoUrl || null;
  const displayUrl = previewUrl || currentLogo;

  return (
    <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden mb-8">
      <div className="bg-black text-white p-2 px-4 uppercase font-black text-sm tracking-widest flex justify-between items-center">
        <span>Team Branding</span>
        {currentLogo && (
          <button 
            onClick={handleRemove}
            className="text-red-400 hover:text-red-200 flex items-center gap-1 text-xs transition-colors"
          >
            <Trash2 className="w-3 h-3" /> REMOVE LOGO
          </button>
        )}
      </div>
      
      <div className="p-6 flex flex-col md:flex-row items-center gap-8">
        {/* Preview Area */}
        <div className="w-32 h-32 md:w-40 md:h-40 border-4 border-orange-600 flex items-center justify-center bg-slate-50 relative shrink-0">
          {displayUrl ? (
            <img src={displayUrl} alt="Team Logo Preview" className="max-w-full max-h-full object-contain p-2" />
          ) : (
            <div className="text-slate-300 flex flex-col items-center">
              <ImageIcon className="w-12 h-12 mb-1" />
              <span className="text-[10px] uppercase font-bold">No Logo</span>
            </div>
          )}
          
          {previewUrl && (
            <button 
              onClick={() => {
                setPreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute -top-3 -right-3 bg-black text-white p-1 hover:bg-orange-600 transition-colors border-2 border-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Controls Area */}
        <div className="flex-grow space-y-4 text-center md:text-left">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Team Logo</h3>
            <p className="text-sm font-medium text-slate-600">
              Upload a logo for your team. Recommended: Square PNG or SVG.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".png,.jpg,.jpeg,.svg"
              className="hidden"
            />
            
            {!previewUrl ? (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-black border-2 border-black hover:bg-slate-100 font-bold uppercase text-xs tracking-widest h-10 px-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
              >
                <Upload className="w-4 h-4 mr-2" /> Select Logo
              </Button>
            ) : (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-orange-600 text-white border-2 border-black hover:bg-orange-700 font-bold uppercase text-xs tracking-widest h-10 px-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
              >
                {isUploading ? "Uploading..." : "Save Logo"}
              </Button>
            )}
            
            {previewUrl && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="font-bold uppercase text-xs tracking-widest text-slate-500 hover:text-black"
              >
                Cancel
              </Button>
            )}
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            MAX SIZE: 5MB • PNG, JPG, SVG
          </p>
        </div>
      </div>
    </div>
  );
}
