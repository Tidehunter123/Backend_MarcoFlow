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
  gender: "man" | "woman";
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

interface MacroResult {
  protein: number;
  fats: number;
  carbs: number;
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

const calculateAge = (dob: string): number => {
  console.log("Received DOB:", dob);

  const [day, month, year] = dob.split("-").map(Number);
  console.log("Parsed values - Day:", day, "Month:", month, "Year:", year);

  const birthDate = new Date(year, month - 1, day);
  console.log("Constructed birthDate:", birthDate);

  const today = new Date();
  console.log("Today's date:", today);

  let age = today.getFullYear() - birthDate.getFullYear();
  console.log("Initial age calculation:", age);

  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
    console.log("Adjusted age after birthday check:", age);
  }

  console.log("Final calculated age:", age);
  return age;
};

const calculateMacros = (
  targetCalories: number,
  weight: number,
  style: string,
  gender: string
): MacroResult => {
  let proteinFactor: number, fatRatio: number;

  switch (style) {
    case "balanced":
      proteinFactor = 2;
      fatRatio = 0.25;
      break;
    case "low_carb":
      proteinFactor = 2.2;
      fatRatio = 0.35;
      break;
    case "keto":
      proteinFactor = 1.6;
      fatRatio = 0.7;
      break;
    case "low_fat":
      proteinFactor = 2.2;
      fatRatio = 0.15;
      break;
    default:
      throw new Error("Invalid nutrition preference");
  }

  const protein = proteinFactor * weight;
  const fatCalories = Math.max(
    targetCalories * fatRatio,
    (gender === "man" ? 50 : 40) * 9
  );
  const fats = fatCalories / 9;

  let carbs = (targetCalories - protein * 4 - fatCalories) / 4;
  if (style === "keto") {
    carbs = Math.min(50, carbs);
  }

  return { protein, fats, carbs };
};

// Example usage
console.log("Calculated Age:", calculateAge("15/08/1990"));

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

export const getProfileDataByProfileId = async (
  profileId: string,
  type: number
) => {
  // Fetch Profile Data
  const { data: profileData, error: profileDataError } = await supabase
    .from("Profile")
    .select()
    .eq("id", profileId)
    .single();

  if (profileDataError) {
    throw new Error(`Error fetching Profile data: ${profileDataError.message}`);
  }

  console.log(profileData, "profileData");

  const age = calculateAge(profileData.date_of_birth);
  console.log(age, "age");

  if (!profileData?.gender) {
    return null;
  }

  const initialWeight = profileData.weight; // Starting weight, e.g., 90kg
  console.log(initialWeight, "initialWeight");
  const weeks = 41;
  let currentWeight = initialWeight;

  console.log(currentWeight, "currentWeight");
  const simulationOutput = [];

  for (let week = 0; week < weeks; week++) {
    // Calculate BMR using currentWeight
    const bmr =
      profileData.gender === "man"
        ? 10 * currentWeight + 6.25 * profileData.height - 5 * age + 5
        : 10 * currentWeight + 6.25 * profileData.height - 5 * age - 161;

    console.log(currentWeight, "currentWeight");

    console.log(bmr, "bmr");

    // Calculate TDEE
    const activityMultipliers = {
      sedentary: 1.13,
      active: 1.25,
      very_active: 1.4,
    };
    let tdee =
      bmr *
      activityMultipliers[
        profileData.activity_level as keyof typeof activityMultipliers
      ];

    // Add workout calories
    const workoutCalories = {
      beginner: 300,
      intermediate: 330,
      advanced: 360,
    };
    const caloriesPerWorkout =
      workoutCalories[
        profileData.training_history as keyof typeof workoutCalories
      ];
    tdee += (caloriesPerWorkout * profileData.workouts_per_week) / 7;

    // Adjust targetCalories based on rate_weight_change
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
        "1kg per week": 7700,
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

    const rate_weight_change = profileData.rate_weight_change as string;
    const [mode, selected] = rate_weight_change.split(/ (.+)/) as [
      "fat_loss" | "muscle_gain",
      (
        | "100g per week"
        | "250g per week"
        | "500g per week"
        | "750g per week"
        | "1kg per week"
      )
    ];

    console.log(
      mode,
      selected,
      tdee,
      profileData.training_goal,
      weightChangeCalories[mode]?.[selected],
      "mode, selected"
    );

    let targetCalories =
      rate_weight_change !== "None" &&
      weightChangeCalories[mode]?.[selected] !== undefined
        ? tdee + weightChangeCalories[mode][selected] / 7
        : tdee *
          goalDefaults[profileData.training_goal as keyof typeof goalDefaults];

    // Handle calorie cycling and banking
    let trainingDayCalories = targetCalories;
    let restDayCalories = targetCalories;
    let weekdayCalories = targetCalories;
    let weekendCalories = targetCalories;
    let averageCalories;
    if (profileData.calorieCycling) {
      const trainingDays = profileData.workouts_per_week;
      const restDays = 7 - trainingDays;
      // const trainingDayFactor = 7 / (2 * trainingDays + restDays);
      // const restDayFactor = 7 / (2 * restDays + trainingDays);
      // trainingDayCalories = targetCalories * (1 + trainingDayFactor);
      // restDayCalories = targetCalories * (1 - restDayFactor);
      const training_day_factor =
        (7 * targetCalories) / (trainingDays * 1.1 + restDays * 0.9);
      const rest_day_factor = training_day_factor * 0.9;

      trainingDayCalories = training_day_factor * 1.1;
      restDayCalories = training_day_factor * 0.9;

      const weekly_calories =
        trainingDayCalories * trainingDays + restDayCalories * restDays;
      averageCalories = weekly_calories / 7;
    }
    if (profileData.calorieBanking) {
      weekdayCalories = targetCalories * 0.85;
      weekendCalories = targetCalories * 1.3;

      const minWeekdayCalories = targetCalories - 250;
      if (weekdayCalories < minWeekdayCalories) {
        weekdayCalories = minWeekdayCalories;
        weekendCalories = (7 * targetCalories - weekdayCalories * 5) / 2;
      }
    }

    // Calculate macros
    let protein: number, fats: number, carbs: number;
    switch (profileData.nutrition_style) {
      case "balanced":
        protein = 2 * currentWeight;
        fats =
          Math.max(
            targetCalories * 0.25,
            (profileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "low_carb":
        protein = 2.2 * currentWeight;
        fats =
          Math.max(
            targetCalories * 0.35,
            (profileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "keto":
        protein = 1.6 * currentWeight;
        fats =
          Math.max(
            targetCalories * 0.7,
            (profileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = Math.min(50, (targetCalories - protein * 4 - fats * 9) / 4);
        break;
      case "low_fat":
        protein = 2.2 * currentWeight;
        fats =
          Math.max(
            targetCalories * 0.15,
            (profileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      default:
        throw new Error("Invalid nutrition preference");
    }

    let trainingMacros, restMacros;
    if (profileData.calorieCycling) {
      trainingMacros = calculateMacros(
        trainingDayCalories,
        initialWeight,
        profileData.nutrition_style,
        profileData.gender
      );
      restMacros = calculateMacros(
        restDayCalories,
        initialWeight,
        profileData.nutrition_style,
        profileData.gender
      );
    }

    let weekdayMacros, weekendMacros;

    if (profileData.calorieBanking) {
      weekdayMacros = calculateMacros(
        weekdayCalories,
        initialWeight,
        profileData.nutrition_style,
        profileData.gender
      );
      weekendMacros = calculateMacros(
        weekendCalories,
        initialWeight,
        profileData.nutrition_style,
        profileData.gender
      );
    }

    // Prepare weekly data
    const weekData = {
      Week: week,
      Weight: Number(currentWeight).toFixed(1),
      BMR: bmr,
      Total_Maintenance_Calories: tdee,
      Target_Calories: targetCalories,
      Protein: Number(protein.toFixed(1)),
      Fats: Number(fats.toFixed(1)),
      Carbohydrates: Number(carbs.toFixed(1)),
      Fibre: profileData.gender === "man" ? 35 : 25,
      ...(profileData.calorieCycling
        ? {
            TrainingDayCalories: trainingDayCalories,
            RestDayCalories: restDayCalories,
            AverageCalories: averageCalories,
            Training_Protein: trainingMacros?.protein,
            Training_Fats: trainingMacros?.fats,
            Training_Carbohydrates: trainingMacros?.carbs,
            Training_Fibre: profileData.gender === "man" ? 35 : 25,
            Rest_Protein: restMacros?.protein,
            Rest_Fats: restMacros?.fats,
            Rest_Carbohydrates: restMacros?.carbs,
            Rest_Fibre: profileData.gender === "man" ? 35 : 25,
          }
        : {
            TrainingDayCalories: null,
            RestDayCalories: null,
            AverageCalories: null,
            Training_Protein: null,
            Training_Fats: null,
            Training_Carbohydrates: null,
            Training_Fibre: null,
            Rest_Protein: null,
            Rest_Fats: null,
            Rest_Carbohydrates: null,
            Rest_Fibre: null,
          }),
      ...(profileData.calorieBanking
        ? {
            WeekdayCalories: weekdayCalories,
            WeekendCalories: weekendCalories,
            Weekday_Protein: weekdayMacros?.protein,
            Weekday_Fats: weekdayMacros?.fats,
            Weekday_Carbohydrates: weekdayMacros?.carbs,
            Weekday_Fibre: profileData.gender === "man" ? 35 : 25,
            Weekend_Protein: weekendMacros?.protein,
            Weekend_Fats: weekendMacros?.fats,
            Weekend_Carbohydrates: weekendMacros?.carbs,
            Weekend_Fibre: profileData.gender === "man" ? 35 : 25,
          }
        : {
            WeekdayCalories: null,
            WeekendCalories: null,
            Weekday_Protein: null,
            Weekday_Fats: null,
            Weekday_Carbohydrates: null,
            Weekday_Fibre: null,
            Weekend_Protein: null,
            Weekend_Fats: null,
            Weekend_Carbohydrates: null,
            Weekend_Fibre: null,
          }),
    };

    simulationOutput.push(weekData);

    if (type === 1) {
      currentWeight *= 0.995;
    } else if (type === 2) {
      currentWeight *= 0.99;
    } else if (type === 3) {
      currentWeight *= 1.005;
    } else if (type === 4) {
      currentWeight *= 1.0075;
    }
  }

  // console.log(simulationOutput, "simulationOutput");

  return { data: simulationOutput, Profile: profileData };

  // // Fetch Calculation Data
  // const { data: CalculationData, error: CalculationDataError } = await supabase
  //   .from("CalculationData")
  //   .select("*")
  //   .eq("id", profileId)
  //   .order("created_at", { ascending: true })
  //   .single(); // Use .single() to fetch a single row

  // if (CalculationDataError) {
  //   throw new Error(
  //     `Error fetching calculation data: ${CalculationDataError.message}`
  //   );
  // }

  // Check if data exists
  // if (!ProfileData || !CalculationData) {
  //   throw new Error("No data found for the given profile ID");
  // }
};

export const getSummaryDataByProfileId = async (profileId: string) => {
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
      weightPerWeek = `${userProfileData.mode} ${userProfileData.selected}`;
    }

    const age = calculateAge(userProfileData.dateOfBirth);

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
          age: userProfileData.age,
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
        age: age,
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
      userProfileData.gender === "man"
        ? 10 * userProfileData.weight +
          6.25 * userProfileData.height -
          5 * age +
          5
        : 10 * userProfileData.weight +
          6.25 * userProfileData.height -
          5 * age -
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
        "1kg per week": 7700,
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

    console.log(
      userProfileData.mode,
      userProfileData.selected,
      tdee,
      userProfileData.trainingGoal,
      "userProfileData.mode,userProfileData.selected"
    );

    let trainingDayCalories = targetCalories;
    let restDayCalories = targetCalories;
    let weekdayCalories = targetCalories;
    let weekendCalories = targetCalories;
    let averageCalories;
    if (userProfileData.calorieCycling) {
      const training_days = userProfileData.workoutsPerWeek;
      const rest_days = 7 - training_days;

      const training_day_factor =
        (7 * targetCalories) / (training_days * 1.1 + rest_days * 0.9);
      const rest_day_factor = training_day_factor * 0.9;

      trainingDayCalories = training_day_factor * 1.1;
      restDayCalories = training_day_factor * 0.9;

      const weekly_calories =
        trainingDayCalories * training_days + restDayCalories * rest_days;
      averageCalories = weekly_calories / 7;
    }
    if (userProfileData.calorieBanking) {
      weekdayCalories = targetCalories * 0.85;
      weekendCalories = targetCalories * 1.3;
      const minWeekdayCalories = targetCalories - 250;
      if (weekdayCalories < minWeekdayCalories) {
        weekdayCalories = minWeekdayCalories;
        weekendCalories = (7 * targetCalories - weekdayCalories * 5) / 2;
      }
    }

    let protein: number, fats: number, carbs: number;
    switch (userProfileData.selectedStyle) {
      case "balanced":
        protein = 2 * userProfileData.weight;
        fats =
          Math.max(
            targetCalories * 0.25,
            (userProfileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "low_carb":
        protein = 2.2 * userProfileData.weight;
        fats =
          Math.max(
            targetCalories * 0.35,
            (userProfileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      case "keto":
        protein = 1.6 * userProfileData.weight;
        fats =
          Math.max(
            targetCalories * 0.7,
            (userProfileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = Math.min(50, (targetCalories - protein * 4 - fats * 9) / 4);
        break;
      case "low_fat":
        protein = 2.2 * userProfileData.weight;
        fats =
          Math.max(
            targetCalories * 0.15,
            (userProfileData.gender === "man" ? 50 : 40) * 9
          ) / 9;
        carbs = (targetCalories - protein * 4 - fats * 9) / 4;
        break;
      default:
        throw new Error("Invalid nutrition preference");
    }

    let trainingMacros, restMacros;

    if (userProfileData.calorieCycling) {
      trainingMacros = calculateMacros(
        trainingDayCalories,
        userProfileData.weight,
        userProfileData.selectedStyle,
        userProfileData.gender
      );
      restMacros = calculateMacros(
        restDayCalories,
        userProfileData.weight,
        userProfileData.selectedStyle,
        userProfileData.gender
      );
    }

    let weekdayMacros, weekendMacros;

    if (userProfileData.calorieBanking) {
      weekdayMacros = calculateMacros(
        weekdayCalories,
        userProfileData.weight,
        userProfileData.selectedStyle,
        userProfileData.gender
      );
      weekendMacros = calculateMacros(
        weekendCalories,
        userProfileData.weight,
        userProfileData.selectedStyle,
        userProfileData.gender
      );
    }

    const jsonData: MacroflowOutput = {
      summary: {
        BMR: bmr,
        Total_Maintenance_Calories: tdee,
        Target_Calories: targetCalories,
        Protein: Number(protein.toFixed(1)),
        Fats: Number(fats.toFixed(1)),
        Carbohydrates: Number(carbs.toFixed(1)),
        Fibre: userProfileData.gender === "man" ? 35 : 25,
        ...(userProfileData.calorieCycling
          ? {
              TrainingDayCalories: trainingDayCalories,
              RestDayCalories: restDayCalories,
              AverageCalories: averageCalories,
              Training_Protein: trainingMacros?.protein,
              Training_Fats: trainingMacros?.fats,
              Training_Carbohydrates: trainingMacros?.carbs,
              Training_Fibre: userProfileData.gender === "man" ? 35 : 25,
              Rest_Protein: restMacros?.protein,
              Rest_Fats: restMacros?.fats,
              Rest_Carbohydrates: restMacros?.carbs,
              Rest_Fibre: userProfileData.gender === "man" ? 35 : 25,
            }
          : {
              TrainingDayCalories: null,
              RestDayCalories: null,
              AverageCalories: null,
              Training_Protein: null,
              Training_Fats: null,
              Training_Carbohydrates: null,
              Training_Fibre: null,
              Rest_Protein: null,
              Rest_Fats: null,
              Rest_Carbohydrates: null,
              Rest_Fibre: null,
            }),
        ...(userProfileData.calorieBanking
          ? {
              WeekdayCalories: weekdayCalories,
              WeekendCalories: weekendCalories,
              Weekday_Protein: weekdayMacros?.protein,
              Weekday_Fats: weekdayMacros?.fats,
              Weekday_Carbohydrates: weekdayMacros?.carbs,
              Weekday_Fibre: userProfileData.gender === "man" ? 35 : 25,
              Weekend_Protein: weekendMacros?.protein,
              Weekend_Fats: weekendMacros?.fats,
              Weekend_Carbohydrates: weekendMacros?.carbs,
              Weekend_Fibre: userProfileData.gender === "man" ? 35 : 25,
            }
          : {
              WeekdayCalories: null,
              WeekendCalories: null,
              Weekday_Protein: null,
              Weekday_Fats: null,
              Weekday_Carbohydrates: null,
              Weekday_Fibre: null,
              Weekend_Protein: null,
              Weekend_Fats: null,
              Weekend_Carbohydrates: null,
              Weekend_Fibre: null,
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

    const { data: trackData, error: trackDataError } = await supabase
      .from("CalculationData")
      .update({
        weight_track: [userProfileData.weight],
        BMR_track: [bmr],
        Total_track: [tdee],
        Target_track: [targetCalories],
        Train_track: [trainingDayCalories],
        Rest_track: [restDayCalories],
        Weekday_track: [weekdayCalories],
        Weekend_track: [weekendCalories],
      })
      .eq("id", userProfileData.id)
      .select()
      .single();
    if (trackDataError) {
      throw new Error(`Error updating Track data: ${trackDataError.message}`);
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

    const age = calculateAge(profileData.date_of_birth);
    console.log(age, "age");

    if (profileData?.gender) {
      const bmr =
        profileData.gender === "man"
          ? 10 * userProfileData.weight +
            6.25 * profileData.height -
            5 * age +
            5
          : 10 * userProfileData.weight +
            6.25 * profileData.height -
            5 * age -
            161;

      console.log(bmr, "bmr");
      const activityMultipliers = {
        sedentary: 1.13,
        active: 1.25,
        very_active: 1.4,
      };
      let tdee =
        bmr *
        activityMultipliers[
          profileData.activity_level as keyof typeof activityMultipliers
        ];

      const workoutCalories = {
        beginner: 300,
        intermediate: 330,
        advanced: 360,
      };
      const caloriesPerWorkout =
        workoutCalories[
          profileData.training_history as keyof typeof workoutCalories
        ];
      tdee += (caloriesPerWorkout * profileData.workouts_per_week) / 7;

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
          "1kg per week": 7700,
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

      const rate_weight_change = profileData.rate_weight_change as string;
      const [mode, selected] = rate_weight_change.split(/ (.+)/) as [
        "fat_loss" | "muscle_gain",
        (
          | "100g per week"
          | "250g per week"
          | "500g per week"
          | "750g per week"
          | "1kg per week"
        )
      ];

      console.log(
        mode,
        selected,
        tdee,
        profileData.training_goal,
        "mode, selected"
      );

      let targetCalories =
        rate_weight_change !== "None" &&
        weightChangeCalories[mode]?.[selected] !== undefined
          ? tdee + weightChangeCalories[mode][selected] / 7
          : tdee *
            goalDefaults[
              profileData.training_goal as keyof typeof goalDefaults
            ];

      let trainingDayCalories = targetCalories;
      let restDayCalories = targetCalories;
      let weekdayCalories = targetCalories;
      let weekendCalories = targetCalories;
      let averageCalories;
      if (profileData.calorieCycling) {
        const training_days = profileData.workouts_per_week;
        const rest_days = 7 - training_days;

        // const training_day_factor = 7 / (2 * training_days + rest_days);
        // const rest_day_factor = 7 / (2 * rest_days + training_days);

        // const trainingDayCalories = targetCalories * (1 + training_day_factor);
        // restDayCalories = targetCalories * (1 - rest_day_factor);

        const training_day_factor =
          (7 * targetCalories) / (training_days * 1.1 + rest_days * 0.9);
        const rest_day_factor = training_day_factor * 0.9;

        trainingDayCalories = training_day_factor * 1.1;
        restDayCalories = training_day_factor * 0.9;

        const weekly_calories =
          trainingDayCalories * training_days + restDayCalories * rest_days;
        averageCalories = weekly_calories / 7;
      }
      if (profileData.calorieBanking) {
        weekdayCalories = targetCalories * 0.85;
        weekendCalories = targetCalories * 1.3;
        const minWeekdayCalories = targetCalories - 250;
        if (weekdayCalories < minWeekdayCalories) {
          weekdayCalories = minWeekdayCalories;
          weekendCalories = (7 * targetCalories - weekdayCalories * 5) / 2;
        }
      }

      let protein: number, fats: number, carbs: number;
      switch (profileData.nutrition_style) {
        case "balanced":
          protein = 2 * userProfileData.weight;
          fats =
            Math.max(
              targetCalories * 0.25,
              (profileData.gender === "man" ? 50 : 40) * 9
            ) / 9;
          carbs = (targetCalories - protein * 4 - fats * 9) / 4;
          break;
        case "low_carb":
          protein = 2.2 * userProfileData.weight;
          fats =
            Math.max(
              targetCalories * 0.35,
              (profileData.gender === "man" ? 50 : 40) * 9
            ) / 9;
          carbs = (targetCalories - protein * 4 - fats * 9) / 4;
          break;
        case "keto":
          protein = 1.6 * userProfileData.weight;
          fats =
            Math.max(
              targetCalories * 0.7,
              (profileData.gender === "man" ? 50 : 40) * 9
            ) / 9;
          carbs = Math.min(50, (targetCalories - protein * 4 - fats * 9) / 4);
          break;
        case "low_fat":
          protein = 2.2 * userProfileData.weight;
          fats =
            Math.max(
              targetCalories * 0.7,
              (profileData.gender === "man" ? 50 : 40) * 9
            ) / 9;
          carbs = (targetCalories - protein * 4 - fats * 9) / 4;
          break;
        default:
          throw new Error("Invalid nutrition preference");
      }

      let trainingMacros, restMacros;

      if (profileData.calorieCycling) {
        trainingMacros = calculateMacros(
          trainingDayCalories,
          userProfileData.weight,
          profileData.nutrition_style,
          profileData.gender
        );
        restMacros = calculateMacros(
          restDayCalories,
          userProfileData.weight,
          profileData.nutrition_style,
          profileData.gender
        );
      }

      let weekdayMacros, weekendMacros;

      if (profileData.calorieBanking) {
        weekdayMacros = calculateMacros(
          weekdayCalories,
          userProfileData.weight,
          profileData.nutrition_style,
          profileData.gender
        );
        weekendMacros = calculateMacros(
          weekendCalories,
          userProfileData.weight,
          profileData.nutrition_style,
          profileData.gender
        );
      }

      const jsonData: MacroflowOutput = {
        summary: {
          BMR: bmr,
          Total_Maintenance_Calories: tdee,
          Target_Calories: targetCalories,
          Protein: Number(protein.toFixed(1)),
          Fats: Number(fats.toFixed(1)),
          Carbohydrates: Number(carbs.toFixed(1)),
          Fibre: profileData.gender === "man" ? 35 : 25,
          ...(profileData.calorieCycling
            ? {
                TrainingDayCalories: trainingDayCalories,
                RestDayCalories: restDayCalories,
                Training_Protein: trainingMacros?.protein,
                Training_Fats: trainingMacros?.fats,
                Training_Carbohydrates: trainingMacros?.carbs,
                Training_Fibre: profileData.gender === "man" ? 35 : 25,
                Rest_Protein: restMacros?.protein,
                Rest_Fats: restMacros?.fats,
                Rest_Carbohydrates: restMacros?.carbs,
                Rest_Fibre: profileData.gender === "man" ? 35 : 25,
              }
            : {
                TrainingDayCalories: null,
                RestDayCalories: null,
                Training_Protein: null,
                Training_Fats: null,
                Training_Carbohydrates: null,
                Training_Fibre: null,
                Rest_Protein: null,
                Rest_Fats: null,
                Rest_Carbohydrates: null,
                Rest_Fibre: null,
              }),
          ...(profileData.calorieBanking
            ? {
                WeekdayCalories: weekdayCalories,
                WeekendCalories: weekendCalories,
                Weekday_Protein: weekdayMacros?.protein,
                Weekday_Fats: weekdayMacros?.fats,
                Weekday_Carbohydrates: weekdayMacros?.carbs,
                Weekday_Fibre: profileData.gender === "man" ? 35 : 25,
                Weekend_Protein: weekendMacros?.protein,
                Weekend_Fats: weekendMacros?.fats,
                Weekend_Carbohydrates: weekendMacros?.carbs,
                Weekend_Fibre: profileData.gender === "man" ? 35 : 25,
              }
            : {
                WeekdayCalories: null,
                WeekendCalories: null,
                Weekday_Protein: null,
                Weekday_Fats: null,
                Weekday_Carbohydrates: null,
                Weekday_Fibre: null,
                Weekend_Protein: null,
                Weekend_Fats: null,
                Weekend_Carbohydrates: null,
                Weekend_Fibre: null,
              }),
        },
      };

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

      const { data: existingCalculationData, error: existingCalculationError } =
        await supabase
          .from("CalculationData") // Replace with your table name
          .select("*") // You can select specific columns if needed
          .eq("id", userProfileData.id)
          .single(); // Ensure only one record is returned

      if (existingCalculationError) {
        throw new Error(
          `Error creating Profile data: ${existingCalculationError.message}`
        );
      }

      console.log(
        existingCalculationData,
        "existingCalculationData",
        existingCalculationData.weight_track,
        existingCalculationData.BMR_track,
        existingCalculationData.Total_track,
        existingCalculationData.Target_track
      );

      existingCalculationData.weight_track.push(userProfileData.weight);
      existingCalculationData.BMR_track.push(bmr);
      existingCalculationData.Total_track.push(tdee);
      existingCalculationData.Target_track.push(targetCalories);
      existingCalculationData.Train_track.push(trainingDayCalories);
      existingCalculationData.Rest_track.push(restDayCalories);
      existingCalculationData.Weekday_track.push(weekdayCalories);
      existingCalculationData.Weekend_track.push(weekendCalories);

      const { data: CalculationData, error: CalculationDataError } =
        await supabase
          .from("CalculationData")
          .update({
            json_data: jsonData,
            updated_at: new Date().toISOString(),
            weight_track: existingCalculationData.weight_track,
            BMR_track: existingCalculationData.BMR_track,
            Total_track: existingCalculationData.Total_track,
            Target_track: existingCalculationData.Target_track,
            Train_track: existingCalculationData.Train_track,
            Rest_track: existingCalculationData.Rest_track,
            Weekday_track: existingCalculationData.Weekday_track,
            Weekend_track: existingCalculationData.Weekend_track,
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
    } else return null;
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
  getSummaryDataByProfileId,
};
