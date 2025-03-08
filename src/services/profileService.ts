import { UUID } from "crypto";
import { supabase } from "../config/superbaseConfig";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: "sk-19bd689f2f8645c4bc32784ef3a874b8",
});

interface UserData {
  id: UUID;
  mail: string;
  age: number;
  dateOfBirth: string;
  gender: "male" | "female";
  height: number;
  weight: number;
  activityLevel: "sedentary" | "active" | "very_active";
  trainingHistory: "beginner" | "intermediate" | "advanced";
  workoutsPerWeek: 3 | 4 | 5;
  trainingGoal:
    | "fat_loss"
    | "muscle_gain"
    | "recomposition"
    | "strength_gain"
    | "athletic_performance"
    | "fitness_model";

  mode: "fat_loss" | "muscle_gain";
  selected?:
    | "100g per week"
    | "250g per week"
    | "500g per week"
    | "750g per week"
    | "1kg per week";

  selectedStyle: "balanced" | "low_carb" | "keto" | "low_fat";
  calorieCycling?: boolean;
  calorieBanking?: boolean;
}

interface MacroflowOutput {
  summary: {
    BMR: number;
    Total_Maintenance_Calories: number;
    Target_Calories: number;
    Protein: number;
    Fats: number;
    Carbohydrates: number;
    Fibre: number;
  };
}

// Get specific chararcters data
export const getProfileData = async () => {
  let query = supabase
    .from("user_profiles")
    .select(`*`)
    .order("created_at", { ascending: true });
  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Error fetching character data: ${error.message}`);
  }
  return data;
};

export const getProfileDataByProfileId = async (profileId: string) => {
  // Fetch Profile Data
  const { data: ProfileData, error: ProfileError } = await supabase
    .from("Profile")
    .select("*")
    .eq("id", profileId)
    .order("created_at", { ascending: true })
    .single(); // Use .single() to fetch a single row

  if (ProfileError) {
    throw new Error(`Error fetching profile data: ${ProfileError.message}`);
  }

  // Fetch Calculation Data
  const { data: CalculationData, error: CalculationDataError } = await supabase
    .from("CalculationData")
    .select("*")
    .eq("id", profileId)
    .order("created_at", { ascending: true })
    .single(); // Use .single() to fetch a single row

  if (CalculationDataError) {
    throw new Error(
      `Error fetching calculation data: ${CalculationDataError.message}`
    );
  }

  // Check if data exists
  if (!ProfileData || !CalculationData) {
    throw new Error("No data found for the given profile ID");
  }

  // Return the combined result
  return {
    Profile: ProfileData,
    CalculationData: CalculationData,
  };
};

export const getMyBlockListById = async (profileId: string) => {
  // Fetch blocked content based on profile ID from the database
  const { data, error } = await supabase
    .from("user_profiles")
    .select("block_list")
    .eq("id", profileId)
    .single();

  if (error) {
    throw new Error(`Error fetching character data: ${error.message}`);
  }
  return data;
};

export const reactivateProfileData = async (user_email: any) => {
  const { data, error } = await supabase
    .from("user_profiles")
    .update({
      is_able: true,
    })
    .eq("user_email", user_email)
    .select();

  if (error) {
    throw new Error(`Error updating profile data: ${error.message}`);
  }

  return data;
};

export const createProfileData = async (userProfileData: UserData) => {
  try {
    // Create a chat completion request
    let weightPerWeek;
    if (userProfileData.selected === null) {
      weightPerWeek = "None";
    } else {
      weightPerWeek = `${userProfileData.mode}  ${userProfileData.selected}`;
    }

    const { data, error } = await supabase
      .from("Profile") // Replace with your table name
      .select("*") // You can select specific columns if needed
      .eq("id", userProfileData.id)
      .single(); // Ensure only one record is returned

    if (error) {
      const { data: profileData, error: profileDataError } = await supabase
        .from("Profile")
        .insert({
          id: userProfileData.id,
          mail: userProfileData.mail,
          date_of_birth: userProfileData.dateOfBirth,
          gender: userProfileData.gender,
          height: userProfileData.height,
          weight: userProfileData.weight,
          activity_level: userProfileData.activityLevel,
          training_history: userProfileData.trainingHistory,
          workouts_per_week: userProfileData.workoutsPerWeek,
          training_goal: userProfileData.trainingGoal,
          rate_weight_change: weightPerWeek,
          nutrition_style: userProfileData.selectedStyle,
          calorieCycling: userProfileData.calorieCycling,
          calorieBanking: userProfileData.calorieBanking,
        })
        .select()
        .single();

      if (profileDataError) {
        throw new Error(
          `Error creating Profile data: ${profileDataError.message}`
        );
      }
    }

    const { data: profileData, error: profileDataError } = await supabase
      .from("Profile")
      .update({
        mail: userProfileData.mail,
        date_of_birth: userProfileData.dateOfBirth,
        gender: userProfileData.gender,
        height: userProfileData.height,
        weight: userProfileData.weight,
        activity_level: userProfileData.activityLevel,
        training_history: userProfileData.trainingHistory,
        workouts_per_week: userProfileData.workoutsPerWeek,
        training_goal: userProfileData.trainingGoal,
        rate_weight_change: weightPerWeek,
        nutrition_style: userProfileData.selectedStyle,
        calorieCycling: userProfileData.calorieCycling,
        calorieBanking: userProfileData.calorieBanking,
      })
      .eq("id", userProfileData.id) // Corrected this line
      .select()
      .single();

    if (profileDataError) {
      throw new Error(
        `Error updating Profile data: ${profileDataError.message}`
      ); // Fixed error message
    }

    const bmr =
      userProfileData.gender === "male"
        ? 10 * userProfileData.weight +
          6.25 * userProfileData.height -
          5 * userProfileData.age +
          5
        : 10 * userProfileData.weight +
          6.25 * userProfileData.height -
          5 * userProfileData.age -
          161;

    const activityMultipliers = {
      sedentary: 1.13,
      active: 1.25,
      very_active: 1.4,
    };
    let tdee = bmr * activityMultipliers[userProfileData.activityLevel];

    const workoutCalories = {
      beginner: 300,
      intermediate: 330,
      advanced: 360,
    };
    const caloriesPerWorkout = workoutCalories[userProfileData.trainingHistory];
    tdee += (caloriesPerWorkout * userProfileData.workoutsPerWeek) / 7;

    const weightChangeCalories = {
      fat_loss: {
        "100g per week": -770,
        "250g per week": -1925,
        "500g per week": -3850,
        "750g per week": -5775,
        "1kg per week": -7700,
      },
      muscle_gain: {
        "100g per week": 770,
        "250g per week": 1925,
        "500g per week": 3850,
        "750g per week": 5775,
        "1kg per week": -7700,
      },
    };

    const goalDefaults = {
      fat_loss: 0.85,
      muscle_gain: 1.05,
      recomposition: 0.9,
      strength_gain: 1.0,
      athletic_performance: 1.0,
      fitness_model: 0.9,
    };

    let targetCalories =
      userProfileData.mode &&
      userProfileData.selected &&
      weightChangeCalories[userProfileData.mode]?.[userProfileData.selected] !==
        undefined
        ? tdee +
          weightChangeCalories[userProfileData.mode][userProfileData.selected] /
            7
        : tdee * goalDefaults[userProfileData.trainingGoal];

    let trainingDayCalories = targetCalories;
    let restDayCalories = targetCalories;
    let weekdayCalories = targetCalories;
    let weekendCalories = targetCalories;
    if (userProfileData.calorieCycling) {
      trainingDayCalories = targetCalories * 1.1;
      restDayCalories = targetCalories * 0.9;
    }
    if (userProfileData.calorieBanking) {
      weekdayCalories = targetCalories * 0.9;
      weekendCalories = targetCalories * 1.1;
    }

    let protein: number, fats: number, carbs: number;
    switch (userProfileData.selectedStyle) {
      case "balanced":
        protein = 2 * userProfileData.weight;
        fats = (targetCalories * 0.25) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "low_carb":
        protein = 2.2 * userProfileData.weight;
        fats = (targetCalories * 0.35) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "keto":
        protein = 1.6 * userProfileData.weight;
        fats = (targetCalories * 0.7) / 9;
        carbs = Math.min(50, (targetCalories - protein * 4 - fats * 9) / 4);
        break;
      case "low_fat":
        protein = 2.2 * userProfileData.weight;
        fats = (targetCalories * 0.15) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      default:
        throw new Error("Invalid nutrition preference");
    }

    const jsonData: MacroflowOutput = {
      summary: {
        BMR: bmr,
        Total_Maintenance_Calories: tdee,
        Target_Calories: targetCalories,
        Protein: Number(protein.toFixed(1)),
        Fats: Number(fats.toFixed(1)),
        Carbohydrates: Number(carbs.toFixed(1)),
        Fibre: userProfileData.gender === "male" ? 35 : 25,
        ...(userProfileData.calorieCycling
          ? {
              TrainingDayCalories: trainingDayCalories,
              RestDayCalories: restDayCalories,
            }
          : {
              TrainingDayCalories: null,
              RestDayCalories: null,
            }),
        ...(userProfileData.calorieBanking
          ? {
              WeekdayCalories: weekdayCalories,
              WeekendCalories: weekendCalories,
            }
          : {
              WeekdayCalories: null,
              WeekendCalories: null,
            }),
      },
    };

    const { data: existingCalculationData, error: existingCalculationError } =
      await supabase
        .from("CalculationData") // Replace with your table name
        .select("*") // You can select specific columns if needed
        .eq("id", userProfileData.id)
        .single(); // Ensure only one record is returned

    if (existingCalculationError) {
      const { data: CalculationData, error: CalculationDataError } =
        await supabase
          .from("CalculationData")
          .insert({
            id: userProfileData.id,
            json_data: jsonData,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

      if (CalculationDataError) {
        throw new Error(
          `Error creating Profile data: ${CalculationDataError.message}`
        );
      }
    } else {
      const { data: CalculationData, error: CalculationDataError } =
        await supabase
          .from("CalculationData")
          .update({
            json_data: jsonData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userProfileData.id)
          .select()
          .single();

      if (CalculationDataError) {
        throw new Error(
          `Error creating Profile data: ${CalculationDataError.message}`
        );
      }
    }

    return jsonData;
  } catch (error) {
    console.error("Error fetching profile data:", error);
    throw new Error("Failed to fetch profile data. Please try again.");
  }
};

export const updateProfileData = async (userProfileData: any) => {
  try {
    const { data: profileData, error: profileDataError } = await supabase
      .from("Profile")
      .select()
      .eq("id", userProfileData.id)
      .single();

    if (profileDataError) {
      throw new Error(
        `Error creating Profile data: ${profileDataError.message}`
      );
    }

    console.log(profileData, "profileData");

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a macro and nutrition calculation engine for a fitness app business. Using the onboarding data provided below, perform the following calculations and return the results in a structured JSON format.

          # 📌 Step 1: User Inputs
            user_data = {
                "date_of_birth": ${profileData.date_of_birth},  # DD/MM/YYYY
                "gender": ${profileData.gender},  # "male" or "female"
                "height_cm": ${profileData.height},
                "weight_kg": ${userProfileData.weight},
                "activity_level": ${profileData.activity_level},  # Options: "sedentary", "active", "very_active"
                "training_history": ${profileData.training_history},  # "beginner", "intermediate", "advanced"
                "workouts_per_week": ${profileData.workouts_per_week},  # 3, 4, or 5 days per week
                "training_goal": ${profileData.training_goal},  # "fat_loss", "muscle_gain", "recomposition", "strength_gain", "athletic_performance", "fitness_model" etc.
                "weekly_weight_change_kg": ${profileData.rate_weight_change},  # User selects kg per week (Can be None)
                "nutrition_preference": ${profileData.nutrition_style}  # "balanced", "low_carb", "keto", "low_fat", etc.
            }

            # 📌 Step 2: Calculate Age from DD/MM/YYYY Format
            today = datetime.date.today()
            dob = datetime.datetime.strptime(user_data["date_of_birth"], "%d/%m/%Y").date()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

            # 📌 Step 3: Calculate BMR (Mifflin-St Jeor Equation)
            if user_data["gender"] == "male":
                BMR = (10 * user_data["weight_kg"]) + (6.25 * user_data["height_cm"]) - (5 * age) + 5
            else:
                BMR = (10 * user_data["weight_kg"]) + (6.25 * user_data["height_cm"]) - (5 * age) - 161

            # 📌 Step 4: Calculate Maintenance Calories (TDEE)
            activity_multipliers = {
                "sedentary": 1.13,
                "active": 1.25,
                "very_active": 1.4
            }
            TDEE = BMR * activity_multipliers[user_data["activity_level"]]

            # 📌 Step 5: Add Workout Calories Based on Training History
            workout_calories = {
                "beginner": 300,
                "intermediate": 330,
                "advanced": 360
            }

            # Get kcal per workout based on experience level
            kcals_per_workout = workout_calories[user_data["training_history"]]

            # Add workout energy expenditure to TDEE (spread across 7 days)
            weekly_training_kcals = kcals_per_workout * user_data["workouts_per_week"]
            TDEE += weekly_training_kcals / 7

            # 📌 Step 6: Adjust Target Calories Based on Weight Change Selection or Default Training Goal

            # Define calorie adjustments per week for each selection
            weight_change_calories = {
                "fat_loss": {
                    "slow": -275 * 7,       # 250g per week
                    "moderate": -550 * 7,   # 500g per week
                    "aggressive": -825 * 7, # 750g per week
                    "rapid": -1100 * 7      # 1kg per week
                },
                "muscle_gain": {
                    "lean": 110 * 7,        # 100g per week
                    "moderate": 275 * 7,    # 250g per week
                    "accelerated": 550 * 7, # 500g per week
                    "bulk": 825 * 7         # 750g per week
                }
            }

            # Check if user manually selected weight change goal
            if user_data["weekly_weight_change_kg"] is not None:
                goal_category = "fat_loss" if user_data["training_goal"] == "fat_loss" else "muscle_gain"
                calorie_adjustment = weight_change_calories[goal_category].get(user_data["weekly_weight_change_kg"], 0)
                target_calories = TDEE + (calorie_adjustment / 7)
            else:
                goal_defaults = {
                    "fat_loss": 0.85,
                    "muscle_gain": 1.05,
                    "recomposition": 0.90,
                    "strength_gain": 1.00,
                    "athletic_performance": 1.00,
                    "fitness_model": 0.90
                }
                target_calories = TDEE * goal_defaults[user_data["training_goal"]]

            # 📌 Step 7: Macro Distribution Based on Nutrition Style
              if user_data["nutrition_preference"] == "balanced": protein_g = 2 * user_data["weight_kg"] fat_calories = target_calories * 0.25
              fats_g = fat_calories / 9
              carbs_g = (target_calories - (protein_g * 4) - fat_calories) / 4

              elif user_data["nutrition_preference"] == "low_carb": protein_g = 2.2 * user_data["weight_kg"] fat_calories = target_calories * 0.35
              fats_g = fat_calories / 9
              carbs_g = (target_calories - (protein_g * 4) - fat_calories) / 4

              elif user_data["nutrition_preference"] == "keto": protein_g = 1.6 * user_data["weight_kg"]
              fat_calories = target_calories * 0.7
              fats_g = fat_calories / 9
              carbs_g = min(50, (target_calories - (protein_g * 4) - fat_calories) / 4)

              elif user_data["nutrition_preference"] == "low_fat": protein_g = 2.2 * user_data["weight_kg"]
              fat_calories = target_calories * 0.15
              fats_g = fat_calories / 9
              carbs_g = (target_calories - (protein_g * 4) - fat_calories) / 4)

            # 📌 Step 8: Generate JSON Output
            macroflow_output = {
                "summary": {
                    "BMR": BMR,
                    "Total_Maintenance_Calories": TDEE,
                    "Target_Calories": target_calories,
                    "Protein": protein_g,
                    "Fats": fats_g,
                    "Carbohydrates": carbs_g,
                    "Fibre": user_data["weight_kg"] * 0.014  # Example: 1.4g per kg of BW for optimal digestion
                }
            }

            # 📌 Step 8: Progression Chart Calculations
            def calculate_progression_chart(initial_weight):
                weeks = []
                for week in range(1, 41):
                    weeks.append({
                        "week": week,
                        "weight_loss_0.5%": initial_weight * (1 - (0.005 * week)),
                        "weight_loss_1%": initial_weight * (1 - (0.01 * week)),
                        "weight_gain_0.5%": initial_weight * (1 + (0.005 * week)),
                        "weight_gain_0.75%": initial_weight * (1 + (0.0075 * week))
                    })
                return weeks

            progression_chart = calculate_progression_chart(user_data["weight_kg"])

            # 📌 Generate JSON Output for Zapier/Google Sheets
            output_json = {
                "macroflow_results": macroflow_output,
                "progression_chart": progression_chart
            }

            # 📌 Print Output for Debugging
            print(json.dumps(output_json, indent=4))

        `,
        },
      ],
      model: "deepseek-chat", // Replace with the correct model name if needed
    });

    // Extract the assistant's response
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response content found in the completion.");
    }

    console.log("Assistant response:", responseContent);
    // Remove unnecessary parts
    const cleanedDataString = responseContent
      .replace(/```json|```/g, "")
      .trim();

    // Parse the cleaned string into a JSON object
    const jsonData = JSON.parse(cleanedDataString);

    const { data: ProfileData, error: ProfileDataError } = await supabase
      .from("Profile")
      .update({
        weight: userProfileData.weight,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userProfileData.id)
      .select()
      .single();

    if (ProfileDataError) {
      throw new Error(
        `Error creating Profile data: ${ProfileDataError.message}`
      );
    }

    console.log(ProfileData, "ProfileData");

    const { data: CalculationData, error: CalculationDataError } =
      await supabase
        .from("CalculationData")
        .update({
          json_data: jsonData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfileData.id)
        .select()
        .single();

    if (CalculationDataError) {
      throw new Error(
        `Error creating Profile data: ${CalculationDataError.message}`
      );
    }

    console.log(CalculationData, "CalculationData");

    return jsonData;
  } catch (error) {
    console.error("Error fetching profile data:", error);
    throw new Error("Failed to fetch profile data. Please try again.");
  }
};

module.exports = {
  getProfileData,
  updateProfileData,
  getProfileDataByProfileId,
  getMyBlockListById,
  reactivateProfileData,
  createProfileData,
};
