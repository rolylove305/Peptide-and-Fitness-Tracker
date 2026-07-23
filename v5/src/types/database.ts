export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      exercise_library: {
        Row: {
          id: string;
          name: string;
          slug: string;
          primary_muscle_group: string;
          secondary_muscle_groups: string[];
          equipment: string[];
          instructions: string[];
          media_url: string | null;
          media_type: 'image' | 'gif' | 'video' | null;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          primary_muscle_group: string;
          secondary_muscle_groups?: string[];
          equipment?: string[];
          instructions?: string[];
          media_url?: string | null;
          media_type?: 'image' | 'gif' | 'video' | null;
          difficulty?: 'beginner' | 'intermediate' | 'advanced';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          primary_muscle_group?: string;
          secondary_muscle_groups?: string[];
          equipment?: string[];
          instructions?: string[];
          media_url?: string | null;
          media_type?: 'image' | 'gif' | 'video' | null;
          difficulty?: 'beginner' | 'intermediate' | 'advanced';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      peptide_protocols: {
        Row: {
          id: string;
          user_id: string;
          peptide_name: string;
          dose_amount: number;
          dose_unit: 'mcg' | 'mg' | 'mL' | 'units';
          frequency_type:
            'daily' | 'selected_days' | 'interval_days' | 'as_needed';
          time_of_day: string | null;
          days_of_week: number[];
          interval_days: number | null;
          start_date: string;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          peptide_name: string;
          dose_amount: number;
          dose_unit: 'mcg' | 'mg' | 'mL' | 'units';
          frequency_type:
            'daily' | 'selected_days' | 'interval_days' | 'as_needed';
          time_of_day?: string | null;
          days_of_week?: number[];
          interval_days?: number | null;
          start_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          peptide_name?: string;
          dose_amount?: number;
          dose_unit?: 'mcg' | 'mg' | 'mL' | 'units';
          frequency_type?:
            'daily' | 'selected_days' | 'interval_days' | 'as_needed';
          time_of_day?: string | null;
          days_of_week?: number[];
          interval_days?: number | null;
          start_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      peptide_administrations: {
        Row: {
          id: string;
          user_id: string;
          protocol_id: string;
          peptide_name_snapshot: string;
          dose_amount_snapshot: number;
          dose_unit_snapshot: 'mcg' | 'mg' | 'mL' | 'units';
          status: 'taken' | 'skipped';
          scheduled_for: string | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          protocol_id: string;
          peptide_name_snapshot: string;
          dose_amount_snapshot: number;
          dose_unit_snapshot: 'mcg' | 'mg' | 'mL' | 'units';
          status?: 'taken' | 'skipped';
          scheduled_for?: string | null;
          recorded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          protocol_id?: string;
          peptide_name_snapshot?: string;
          dose_amount_snapshot?: number;
          dose_unit_snapshot?: 'mcg' | 'mg' | 'mL' | 'units';
          status?: 'taken' | 'skipped';
          scheduled_for?: string | null;
          recorded_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'peptide_administrations_protocol_id_fkey';
            columns: ['protocol_id'];
            isOneToOne: false;
            referencedRelation: 'peptide_protocols';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_routines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          goal: string | null;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          source: 'user' | 'ai' | 'template';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          goal?: string | null;
          difficulty?: 'beginner' | 'intermediate' | 'advanced';
          source?: 'user' | 'ai' | 'template';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          goal?: string | null;
          difficulty?: 'beginner' | 'intermediate' | 'advanced';
          source?: 'user' | 'ai' | 'template';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_routine_days: {
        Row: {
          id: string;
          routine_id: string;
          day_order: number;
          name: string;
          focus: string | null;
          focus_muscle_groups: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          routine_id: string;
          day_order: number;
          name: string;
          focus?: string | null;
          focus_muscle_groups?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          routine_id?: string;
          day_order?: number;
          name?: string;
          focus?: string | null;
          focus_muscle_groups?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_routine_days_routine_id_fkey';
            columns: ['routine_id'];
            isOneToOne: false;
            referencedRelation: 'workout_routines';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_routine_exercises: {
        Row: {
          id: string;
          routine_day_id: string;
          exercise_id: string;
          exercise_order: number;
          target_sets: number;
          target_reps_min: number | null;
          target_reps_max: number | null;
          target_rest_seconds: number;
          tempo: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          routine_day_id: string;
          exercise_id: string;
          exercise_order: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_rest_seconds?: number;
          tempo?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          routine_day_id?: string;
          exercise_id?: string;
          exercise_order?: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_rest_seconds?: number;
          tempo?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_routine_exercises_routine_day_id_fkey';
            columns: ['routine_day_id'];
            isOneToOne: false;
            referencedRelation: 'workout_routine_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_routine_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          routine_day_id: string | null;
          name: string;
          status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          started_at: string;
          completed_at: string | null;
          body_weight: number | null;
          weight_unit: 'lb' | 'kg';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          routine_day_id?: string | null;
          name: string;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          started_at?: string;
          completed_at?: string | null;
          body_weight?: number | null;
          weight_unit?: 'lb' | 'kg';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_day_id?: string | null;
          name?: string;
          status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
          started_at?: string;
          completed_at?: string | null;
          body_weight?: number | null;
          weight_unit?: 'lb' | 'kg';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_routine_day_id_fkey';
            columns: ['routine_day_id'];
            isOneToOne: false;
            referencedRelation: 'workout_routine_days';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          exercise_order: number;
          exercise_name_snapshot: string;
          primary_muscle_group_snapshot: string | null;
          target_sets_snapshot: number;
          target_reps_min_snapshot: number | null;
          target_reps_max_snapshot: number | null;
          target_rest_seconds_snapshot: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          exercise_order: number;
          exercise_name_snapshot: string;
          primary_muscle_group_snapshot?: string | null;
          target_sets_snapshot?: number;
          target_reps_min_snapshot?: number | null;
          target_reps_max_snapshot?: number | null;
          target_rest_seconds_snapshot?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          exercise_order?: number;
          exercise_name_snapshot?: string;
          primary_muscle_group_snapshot?: string | null;
          target_sets_snapshot?: number;
          target_reps_min_snapshot?: number | null;
          target_reps_max_snapshot?: number | null;
          target_rest_seconds_snapshot?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_session_exercises_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_session_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_library';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          set_number: number;
          weight: number | null;
          weight_unit: 'lb' | 'kg';
          reps: number | null;
          duration_seconds: number | null;
          distance: number | null;
          distance_unit: 'mi' | 'km' | 'm' | 'yd' | 'ft' | null;
          rpe: number | null;
          is_warmup: boolean;
          is_completed: boolean;
          rest_seconds_actual: number | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_exercise_id: string;
          set_number: number;
          weight?: number | null;
          weight_unit?: 'lb' | 'kg';
          reps?: number | null;
          duration_seconds?: number | null;
          distance?: number | null;
          distance_unit?: 'mi' | 'km' | 'm' | 'yd' | 'ft' | null;
          rpe?: number | null;
          is_warmup?: boolean;
          is_completed?: boolean;
          rest_seconds_actual?: number | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_exercise_id?: string;
          set_number?: number;
          weight?: number | null;
          weight_unit?: 'lb' | 'kg';
          reps?: number | null;
          duration_seconds?: number | null;
          distance?: number | null;
          distance_unit?: 'mi' | 'km' | 'm' | 'yd' | 'ft' | null;
          rpe?: number | null;
          is_warmup?: boolean;
          is_completed?: boolean;
          rest_seconds_actual?: number | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_session_exercise_id_fkey';
            columns: ['session_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'workout_session_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      workout_session_summaries: {
        Row: {
          id: string | null;
          user_id: string | null;
          routine_day_id: string | null;
          name: string | null;
          started_at: string | null;
          completed_at: string | null;
          duration_seconds: number | null;
          exercise_count: number | null;
          completed_set_count: number | null;
          working_set_count: number | null;
          total_reps: number | null;
          total_volume: number | null;
          weight_unit: string | null;
        };
        Relationships: [];
      };
      workout_exercise_records: {
        Row: {
          user_id: string | null;
          exercise_id: string | null;
          exercise_name: string | null;
          primary_muscle_group: string | null;
          weight_unit: string | null;
          session_count: number | null;
          completed_set_count: number | null;
          total_reps: number | null;
          heaviest_weight: number | null;
          highest_reps: number | null;
          best_set_volume: number | null;
          last_performed_at: string | null;
        };
        Relationships: [];
      };
      workout_muscle_volume_daily: {
        Row: {
          user_id: string | null;
          workout_date: string | null;
          muscle_group: string | null;
          weight_unit: string | null;
          completed_set_count: number | null;
          total_reps: number | null;
          total_volume: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      save_workout_routine_tree: {
        Args: {
          p_routine: Json;
          p_routine_id?: string | null;
        };
        Returns: string;
      };
      start_workout_session_from_day: {
        Args: { p_routine_day_id: string };
        Returns: string;
      };
      complete_workout_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      cancel_workout_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      get_previous_exercise_performance: {
        Args: { p_exercise_ids: string[] };
        Returns: Array<{
          exercise_id: string;
          session_id: string;
          performed_at: string;
          weight_unit: string;
          sets: Json;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database['public']['Tables'];
export type TableRow<T extends TableName> =
  Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends TableName> =
  Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends TableName> =
  Database['public']['Tables'][T]['Update'];

export type Exercise = TableRow<'exercise_library'>;
export type PeptideProtocol = TableRow<'peptide_protocols'>;
export type PeptideAdministration = TableRow<'peptide_administrations'>;
export type WorkoutRoutine = TableRow<'workout_routines'>;
export type WorkoutRoutineDay = TableRow<'workout_routine_days'>;
export type WorkoutRoutineExercise = TableRow<'workout_routine_exercises'>;
export type WorkoutSession = TableRow<'workout_sessions'>;
export type WorkoutSessionExercise = TableRow<'workout_session_exercises'>;
export type WorkoutSet = TableRow<'workout_sets'>;

export type DatabaseRelationship = Relationship;
